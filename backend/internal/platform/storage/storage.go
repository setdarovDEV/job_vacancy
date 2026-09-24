// Package storage talks to S3-compatible object storage.
//
// Two buckets: a public one (the published image variants: avatars, logos, covers)
// readable by anyone through nginx, and a private one (every upload as sent, chat
// attachments, cached resume PDFs) readable only through short-lived signed URLs.
// Clients upload directly to storage with presigned POST policies, so file bytes never
// pass through the API.
package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/minio/minio-go/v7/pkg/lifecycle"

	"jobvacancy.uz/backend/internal/config"
)

type Storage struct {
	api     *minio.Client // server-side operations
	presign *minio.Client // same credentials, public host: signs URLs clients will call
	cfg     config.S3
}

func New(cfg config.S3) (*Storage, error) {
	mk := func(endpoint string, ssl bool) (*minio.Client, error) {
		return minio.New(endpoint, &minio.Options{
			Creds:        credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
			Secure:       ssl,
			Region:       cfg.Region, // set explicitly so presigning never needs a network call
			BucketLookup: minio.BucketLookupPath,
		})
	}
	api, err := mk(cfg.Endpoint, cfg.UseSSL)
	if err != nil {
		return nil, fmt.Errorf("storage: %w", err)
	}
	pre, err := mk(cfg.PublicEndpoint, cfg.PublicUseSSL)
	if err != nil {
		return nil, fmt.Errorf("storage: %w", err)
	}
	return &Storage{api: api, presign: pre, cfg: cfg}, nil
}

func (s *Storage) PublicBucket() string  { return s.cfg.PublicBucket }
func (s *Storage) PrivateBucket() string { return s.cfg.PrivateBucket }

// EnsureBuckets creates both buckets if needed and makes the public one anonymously
// readable (objects only, no listing).
func (s *Storage) EnsureBuckets(ctx context.Context) error {
	for _, b := range []string{s.cfg.PublicBucket, s.cfg.PrivateBucket} {
		ok, err := s.api.BucketExists(ctx, b)
		if err != nil {
			return fmt.Errorf("storage: bucket %s: %w", b, err)
		}
		if !ok {
			if err := s.api.MakeBucket(ctx, b, minio.MakeBucketOptions{Region: s.cfg.Region}); err != nil {
				return fmt.Errorf("storage: create bucket %s: %w", b, err)
			}
		}
	}
	policy := fmt.Sprintf(`{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":["*"]},`+
		`"Action":["s3:GetObject"],"Resource":["arn:aws:s3:::%s/*"]}]}`, s.cfg.PublicBucket)
	if err := s.api.SetBucketPolicy(ctx, s.cfg.PublicBucket, policy); err != nil {
		return fmt.Errorf("storage: public policy: %w", err)
	}
	return nil
}

// ExpirePrefix makes objects under prefix in bucket expire days after they were written
// (a lifecycle rule, merged with the bucket's other rules by id). Stores without
// lifecycle support return an error the caller may only log.
func (s *Storage) ExpirePrefix(ctx context.Context, bucket, id, prefix string, days int) error {
	cfg, err := s.api.GetBucketLifecycle(ctx, bucket)
	if err != nil {
		if code := minio.ToErrorResponse(err).Code; code != "NoSuchLifecycleConfiguration" {
			return fmt.Errorf("storage: lifecycle of %s: %w", bucket, err)
		}
		cfg = lifecycle.NewConfiguration()
	}
	rules := cfg.Rules[:0]
	for _, r := range cfg.Rules {
		if r.ID != id {
			rules = append(rules, r)
		}
	}
	cfg.Rules = append(rules, lifecycle.Rule{ID: id, Status: "Enabled",
		RuleFilter: lifecycle.Filter{Prefix: prefix}, Expiration: lifecycle.Expiration{Days: lifecycle.ExpirationDays(days)}})
	if err := s.api.SetBucketLifecycle(ctx, bucket, cfg); err != nil {
		return fmt.Errorf("storage: lifecycle of %s: %w", bucket, err)
	}
	return nil
}

// RemovePrefix deletes every object under prefix; it returns how many.
func (s *Storage) RemovePrefix(ctx context.Context, bucket, prefix string) (int, error) {
	n := 0
	for obj := range s.api.ListObjects(ctx, bucket, minio.ListObjectsOptions{Prefix: prefix, Recursive: true}) {
		if obj.Err != nil {
			return n, obj.Err
		}
		if err := s.api.RemoveObject(ctx, bucket, obj.Key, minio.RemoveObjectOptions{}); err != nil {
			return n, err
		}
		n++
	}
	return n, nil
}

// PresignPost returns a URL and form fields for a browser/app multipart upload of exactly
// one object, with the content type and a maximum size enforced by storage itself.
func (s *Storage) PresignPost(ctx context.Context, bucket, key, contentType string, maxSize int64, ttl time.Duration) (string, map[string]string, error) {
	p := minio.NewPostPolicy()
	for _, err := range []error{
		p.SetBucket(bucket), p.SetKey(key), p.SetContentType(contentType),
		p.SetContentLengthRange(1, maxSize), p.SetExpires(time.Now().UTC().Add(ttl)),
	} {
		if err != nil {
			return "", nil, fmt.Errorf("storage: post policy: %w", err)
		}
	}
	u, fields, err := s.presign.PresignedPostPolicy(ctx, p)
	if err != nil {
		return "", nil, fmt.Errorf("storage: presign post: %w", err)
	}
	return u.String(), fields, nil
}

type ObjectInfo struct {
	Size        int64
	ContentType string
}

func (s *Storage) Stat(ctx context.Context, bucket, key string) (ObjectInfo, error) {
	info, err := s.api.StatObject(ctx, bucket, key, minio.StatObjectOptions{})
	if err != nil {
		return ObjectInfo{}, err
	}
	return ObjectInfo{Size: info.Size, ContentType: info.ContentType}, nil
}

// Head reads up to n leading bytes of an object (for content sniffing).
func (s *Storage) Head(ctx context.Context, bucket, key string, n int64) ([]byte, error) {
	opts := minio.GetObjectOptions{}
	if err := opts.SetRange(0, n-1); err != nil {
		return nil, err
	}
	obj, err := s.api.GetObject(ctx, bucket, key, opts)
	if err != nil {
		return nil, err
	}
	defer obj.Close()
	return io.ReadAll(io.LimitReader(obj, n))
}

// PresignGet signs a download URL. attachment forces a download dialog, so uploaded
// documents are never rendered inline in the browser.
func (s *Storage) PresignGet(ctx context.Context, bucket, key string, ttl time.Duration, filename string, attachment bool) (string, error) {
	params := url.Values{}
	disp := "inline"
	if attachment {
		disp = "attachment"
	}
	if filename != "" {
		disp += `; filename*=UTF-8''` + url.PathEscape(filename)
	}
	params.Set("response-content-disposition", disp)
	u, err := s.presign.PresignedGetObject(ctx, bucket, key, ttl, params)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

// ErrObjectTooLarge: the object is bigger than the caller is willing to hold in memory.
var ErrObjectTooLarge = fmt.Errorf("storage: object too large")

// Get reads a whole object of at most max bytes.
func (s *Storage) Get(ctx context.Context, bucket, key string, max int64) ([]byte, error) {
	obj, err := s.api.GetObject(ctx, bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, err
	}
	defer obj.Close()
	b, err := io.ReadAll(io.LimitReader(obj, max+1))
	if err != nil {
		return nil, err
	}
	if int64(len(b)) > max {
		return nil, ErrObjectTooLarge
	}
	return b, nil
}

// Put stores data as an object.
func (s *Storage) Put(ctx context.Context, bucket, key string, data []byte, contentType, cacheControl string) error {
	_, err := s.api.PutObject(ctx, bucket, key, bytes.NewReader(data), int64(len(data)),
		minio.PutObjectOptions{ContentType: contentType, CacheControl: cacheControl})
	return err
}

// IsNotFound reports a missing object or bucket.
func IsNotFound(err error) bool {
	code := minio.ToErrorResponse(err).Code
	return code == "NoSuchKey" || code == "NoSuchBucket"
}

// PublicKey returns the object key of a URL in the public bucket (ok false for other URLs,
// e.g. Google avatars).
func (s *Storage) PublicKey(u string) (string, bool) {
	base := strings.TrimRight(s.cfg.PublicBaseURL, "/") + "/"
	if !strings.HasPrefix(u, base) || len(u) == len(base) {
		return "", false
	}
	return strings.TrimPrefix(u, base), true
}

func (s *Storage) Remove(ctx context.Context, bucket, key string) error {
	return s.api.RemoveObject(ctx, bucket, key, minio.RemoveObjectOptions{})
}

// PublicURL is the permanent URL of an object in the public bucket.
func (s *Storage) PublicURL(key string) string {
	return strings.TrimRight(s.cfg.PublicBaseURL, "/") + "/" + key
}

// Ping checks that object storage answers and the public bucket exists (/readyz).
func (s *Storage) Ping(ctx context.Context) error {
	ok, err := s.api.BucketExists(ctx, s.cfg.PublicBucket)
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("storage: bucket %s is missing", s.cfg.PublicBucket)
	}
	return nil
}
