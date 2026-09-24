// Package imgurl names the published variants of processed images (TZ BE-14) and lists
// them for DTOs (avatar_urls, logo_urls, cover_urls → srcset, TZ FE-04). It has no
// dependencies so any module's DTO can use it.
//
// Variant keys are img/<target>/<yyyy>/<mm>/<file id>/<size>.webp in the public bucket;
// the shown URL is the largest one, and the other sizes follow from it.
package imgurl

import (
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Target is what an image is used for.
type Target string

const (
	Avatar Target = "avatar"
	Logo   Target = "logo"
	Cover  Target = "cover"
)

// Sizes are the variant sizes per target, smallest first: avatars are squares, logos fit
// a square box of that size, covers are that wide.
var Sizes = map[Target][]int{
	Avatar: {64, 128, 256},
	Logo:   {64, 128, 256},
	Cover:  {640, 1280},
}

func (t Target) Valid() bool { _, ok := Sizes[t]; return ok }

// Largest is the size the shown URL points at.
func (t Target) Largest() int { s := Sizes[t]; return s[len(s)-1] }

// Key names one variant in the public bucket.
func Key(t Target, fileID uuid.UUID, uploaded time.Time, size int) string {
	return "img/" + string(t) + "/" + uploaded.UTC().Format("2006/01") + "/" + fileID.String() + "/" +
		strconv.Itoa(size) + ".webp"
}

var variantRe = regexp.MustCompile(`(^|/)img/(avatar|logo|cover)/\d{4}/\d{2}/([0-9a-f-]{36})/(\d+)\.webp$`)

// Variant is what a URL (or key) says about a processed image.
type Variant struct {
	Target Target
	FileID uuid.UUID
	Size   int
	prefix string // everything up to "<size>.webp"
	keyDir string // img/<target>/<yyyy>/<mm>/<file id>/
}

// Parse recognises the URL or key of a processed image; ok is false for legacy uploads
// and external pictures (Google avatars).
func Parse(u string) (Variant, bool) {
	m := variantRe.FindStringSubmatch(u)
	if m == nil {
		return Variant{}, false
	}
	id, err := uuid.Parse(m[3])
	if err != nil {
		return Variant{}, false
	}
	size, _ := strconv.Atoi(m[4])
	match := strings.TrimPrefix(m[0], "/")
	return Variant{Target: Target(m[2]), FileID: id, Size: size, prefix: strings.TrimSuffix(u, m[4]+".webp"),
		keyDir: strings.TrimSuffix(match, m[4]+".webp")}, true
}

// Keys are the object keys of every size (in the public bucket).
func (v Variant) Keys() []string {
	out := make([]string, 0, len(Sizes[v.Target]))
	for _, s := range Sizes[v.Target] {
		out = append(out, v.keyDir+strconv.Itoa(s)+".webp")
	}
	return out
}

// Of is the same image at another size.
func (v Variant) Of(size int) string { return v.prefix + strconv.Itoa(size) + ".webp" }

// All lists the image at every size of its target.
func (v Variant) All() []string {
	out := make([]string, 0, len(Sizes[v.Target]))
	for _, s := range Sizes[v.Target] {
		out = append(out, v.Of(s))
	}
	return out
}

// URLs maps each size ("64", "128", …) to its URL; nil unless u is a processed image.
func URLs(u *string) map[string]string {
	if u == nil {
		return nil
	}
	v, ok := Parse(*u)
	if !ok {
		return nil
	}
	out := make(map[string]string, len(Sizes[v.Target]))
	for _, s := range Sizes[v.Target] {
		out[strconv.Itoa(s)] = v.Of(s)
	}
	return out
}

// Pending reports that the owner chose an upload (chosen) that isn't shown yet: the worker
// is still publishing its sizes.
func Pending(chosen *uuid.UUID, shown *string) bool {
	if chosen == nil {
		return false
	}
	if shown != nil {
		if v, ok := Parse(*shown); ok && v.FileID == *chosen {
			return false
		}
	}
	return true
}
