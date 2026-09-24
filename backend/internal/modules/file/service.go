// Package file handles uploads: it issues presigned POST policies, verifies what was
// actually uploaded, and turns stored objects into URLs.
package file

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"path"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/random"
	"jobvacancy.uz/backend/internal/platform/storage"
)

const (
	uploadTTL   = 15 * time.Minute
	DownloadTTL = time.Hour
	MB          = 1 << 20
)

var (
	ErrNotFound    = apperr.NotFound("file_not_found", "file not found")
	ErrType        = apperr.Validation(map[string]string{"content_type": "not_allowed"})
	ErrTooBig      = apperr.Validation(map[string]string{"size": "too_large"})
	ErrNotUploaded = apperr.Conflict("file_not_uploaded", "upload the file before completing it")
	ErrMismatch    = apperr.BadRequest("file_content_mismatch", "file contents don't match its type")
	ErrNotReady    = apperr.Conflict("file_not_ready", "file upload isn't complete")
	ErrWrongUse    = apperr.BadRequest("file_wrong_purpose", "this file was uploaded for something else")
)

// rule describes one upload purpose. Every upload lands in the private bucket; the only
// public files are the image variants the worker publishes.
type rule struct {
	maxSize int64
	// allowed maps a declared content type to the types http.DetectContentType may report
	// for it ("" = accept any sniff result except active content).
	allowed map[string][]string
	// attachment: always download, never render inline.
	attachment bool
}

var images = map[string][]string{
	"image/jpeg": {"image/jpeg"}, "image/png": {"image/png"}, "image/webp": {"image/webp"},
}

// Avatars, logos and covers are uploaded privately: the worker publishes re-encoded
// variants without metadata (package media, TZ BE-14/SEC-06), so the original with its
// EXIF (GPS position, camera) is never public.
var rules = map[gen.FilePurpose]rule{
	gen.FilePurposeAvatar:       {maxSize: 5 * MB, allowed: images},
	gen.FilePurposeCompanyLogo:  {maxSize: 5 * MB, allowed: images},
	gen.FilePurposeCompanyCover: {maxSize: 10 * MB, allowed: images},
	gen.FilePurposeChatImage: {maxSize: 10 * MB, allowed: map[string][]string{
		"image/jpeg": {"image/jpeg"}, "image/png": {"image/png"}, "image/webp": {"image/webp"}, "image/gif": {"image/gif"},
	}},
	gen.FilePurposeChatVoice: {maxSize: 5 * MB, allowed: map[string][]string{
		// Browsers record webm/ogg (Opus), iOS records m4a (AAC); Go sniffs containers.
		"audio/webm": {"video/webm", "audio/webm"}, "audio/ogg": {"application/ogg", "audio/ogg"},
		"audio/mp4": {"video/mp4", "audio/mp4", "application/octet-stream"}, "audio/mpeg": {"audio/mpeg"},
		"audio/aac": {"audio/aac", "application/octet-stream"},
	}},
	gen.FilePurposeChatFile: {maxSize: 25 * MB, attachment: true, allowed: map[string][]string{
		"application/pdf":    {"application/pdf"},
		"application/msword": {""}, "application/vnd.ms-excel": {""}, "application/vnd.ms-powerpoint": {""},
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document":   {"application/zip"},
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":         {"application/zip"},
		"application/vnd.openxmlformats-officedocument.presentationml.presentation": {"application/zip"},
		"text/plain":      {"text/plain; charset=utf-8", "text/plain; charset=utf-16le", "text/plain; charset=utf-16be"},
		"application/zip": {"application/zip"}, "application/x-rar-compressed": {""},
		"image/jpeg": {"image/jpeg"}, "image/png": {"image/png"},
	}},
}

// Never accepted, whatever was declared: content a browser would execute.
var active = []string{"text/html; charset=utf-8", "text/xml; charset=utf-8", "image/svg+xml", "application/javascript"}

type Service struct {
	Q       *gen.Queries
	Storage *storage.Storage
	Log     *slog.Logger
}

type CreateInput struct {
	Purpose     string          `json:"purpose" validate:"required,oneof=avatar company_logo company_cover chat_image chat_file chat_voice"`
	ContentType string          `json:"content_type" validate:"required,max=127"`
	Size        int64           `json:"size" validate:"required,min=1"`
	Name        string          `json:"name" validate:"max=200"`
	Meta        json.RawMessage `json:"meta"` // {"duration_ms":…} or {"width":…,"height":…}
}

type Upload struct {
	URL    string            `json:"url"`
	Method string            `json:"method"`
	Fields map[string]string `json:"fields"` // send all as form fields, then the "file" field last
}

// Create registers a pending file and returns a presigned POST for uploading it.
func (s *Service) Create(ctx context.Context, owner uuid.UUID, in CreateInput) (DTO, Upload, error) {
	purpose := gen.FilePurpose(in.Purpose)
	r := rules[purpose]
	ct := strings.ToLower(strings.TrimSpace(in.ContentType))
	if _, ok := r.allowed[ct]; !ok {
		return DTO{}, Upload{}, ErrType
	}
	if in.Size > r.maxSize {
		return DTO{}, Upload{}, ErrTooBig
	}
	meta, err := cleanMeta(in.Meta)
	if err != nil {
		return DTO{}, Upload{}, err
	}
	bucket := s.Storage.PrivateBucket()
	// Unguessable key; the original name is kept only in the row (for downloads).
	key := fmt.Sprintf("%s/%s/%s%s", strings.ReplaceAll(in.Purpose, "_", "-"),
		time.Now().UTC().Format("2006/01"), random.Base36(24), extension(ct))
	f, err := s.Q.CreateFile(ctx, gen.CreateFileParams{
		OwnerID: owner, Purpose: purpose, Bucket: bucket, ObjectKey: key,
		ContentType: ct, Name: cleanName(in.Name), Meta: meta,
	})
	if err != nil {
		return DTO{}, Upload{}, err
	}
	u, fields, err := s.Storage.PresignPost(ctx, bucket, key, ct, r.maxSize, uploadTTL)
	if err != nil {
		return DTO{}, Upload{}, err
	}
	d, err := s.DTO(ctx, f)
	return d, Upload{URL: u, Method: http.MethodPost, Fields: fields}, err
}

// Complete checks the uploaded object (it exists, fits the limit, and its first bytes
// really are what was declared) and marks the file ready.
func (s *Service) Complete(ctx context.Context, owner, id uuid.UUID) (DTO, error) {
	f, err := s.owned(ctx, owner, id)
	if err != nil {
		return DTO{}, err
	}
	if f.Status == gen.FileStatusReady {
		return s.DTO(ctx, f)
	}
	info, err := s.Storage.Stat(ctx, f.Bucket, f.ObjectKey)
	if err != nil {
		return DTO{}, ErrNotUploaded
	}
	r := rules[f.Purpose]
	head, err := s.Storage.Head(ctx, f.Bucket, f.ObjectKey, 512)
	if err != nil {
		return DTO{}, err
	}
	sniffed := http.DetectContentType(head)
	want := r.allowed[f.ContentType]
	ok := !slices.Contains(active, sniffed) && info.Size <= r.maxSize &&
		(slices.Contains(want, "") || slices.Contains(want, sniffed))
	if !ok {
		s.Log.WarnContext(ctx, "upload rejected", "file_id", f.ID, "declared", f.ContentType, "sniffed", sniffed, "size", info.Size)
		_ = s.Storage.Remove(ctx, f.Bucket, f.ObjectKey)
		_ = s.Q.DeleteFile(ctx, f.ID)
		return DTO{}, ErrMismatch
	}
	f, err = s.Q.MarkFileReady(ctx, gen.MarkFileReadyParams{ID: f.ID, Size: info.Size, ContentType: f.ContentType})
	if err != nil {
		return DTO{}, err
	}
	return s.DTO(ctx, f)
}

// Use loads a ready file owned by owner for the given purpose (e.g. setting an avatar
// or attaching to a message).
func (s *Service) Use(ctx context.Context, owner, id uuid.UUID, purposes ...gen.FilePurpose) (gen.File, error) {
	f, err := s.owned(ctx, owner, id)
	if err != nil {
		return f, err
	}
	if f.Status != gen.FileStatusReady {
		return f, ErrNotReady
	}
	if !slices.Contains(purposes, f.Purpose) {
		return f, ErrWrongUse
	}
	return f, nil
}

func (s *Service) owned(ctx context.Context, owner, id uuid.UUID) (gen.File, error) {
	f, err := s.Q.GetFile(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && f.OwnerID != owner) {
		return f, ErrNotFound
	}
	return f, err
}

// URL is a permanent URL for public files and a signed, expiring one for private files.
func (s *Service) URL(ctx context.Context, f gen.File) (string, error) {
	if f.Bucket == s.Storage.PublicBucket() { // uploads from before images were processed
		return s.Storage.PublicURL(f.ObjectKey), nil
	}
	return s.Storage.PresignGet(ctx, f.Bucket, f.ObjectKey, DownloadTTL, f.Name, rules[f.Purpose].attachment)
}

// CleanupPending deletes uploads that were never completed.
func (s *Service) CleanupPending(ctx context.Context) (int, error) {
	stale, err := s.Q.ListStalePendingFiles(ctx)
	if err != nil {
		return 0, err
	}
	for _, f := range stale {
		if err := s.Storage.Remove(ctx, f.Bucket, f.ObjectKey); err != nil {
			s.Log.WarnContext(ctx, "remove stale upload", "file_id", f.ID, "err", err)
		}
		if err := s.Q.DeleteFile(ctx, f.ID); err != nil {
			return 0, err
		}
	}
	return len(stale), nil
}

// ---- helpers -----------------------------------------------------------------------------

var extensions = map[string]string{
	"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
	"audio/webm": ".webm", "audio/ogg": ".ogg", "audio/mp4": ".m4a", "audio/mpeg": ".mp3", "audio/aac": ".aac",
	"application/pdf": ".pdf", "application/msword": ".doc", "application/vnd.ms-excel": ".xls",
	"application/vnd.ms-powerpoint": ".ppt", "text/plain": ".txt", "application/zip": ".zip",
	"application/x-rar-compressed":                                              ".rar",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document":   ".docx",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":         ".xlsx",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
}

func extension(ct string) string { return extensions[ct] }

// cleanName keeps the base name only and drops control characters.
func cleanName(n string) string {
	n = path.Base(strings.ReplaceAll(strings.TrimSpace(n), "\\", "/"))
	if n == "." || n == "/" {
		return ""
	}
	return strings.Map(func(r rune) rune {
		if r < 32 || r == 127 {
			return -1
		}
		return r
	}, n)
}

// cleanMeta keeps only the known numeric fields.
func cleanMeta(raw json.RawMessage) ([]byte, error) {
	if len(raw) == 0 {
		return []byte("{}"), nil
	}
	var in struct {
		DurationMS *int `json:"duration_ms"`
		Width      *int `json:"width"`
		Height     *int `json:"height"`
	}
	if err := json.Unmarshal(raw, &in); err != nil {
		return nil, apperr.Validation(map[string]string{"meta": "object"})
	}
	out := map[string]int{}
	for k, v := range map[string]*int{"duration_ms": in.DurationMS, "width": in.Width, "height": in.Height} {
		if v != nil && *v > 0 && *v < 10_000_000 {
			out[k] = *v
		}
	}
	return json.Marshal(out)
}
