// Package imaging re-encodes user images (TZ BE-14, SEC-06): it decodes JPEG, PNG and
// WebP with a guard against decompression bombs, applies the JPEG EXIF orientation,
// produces resized variants and encodes them as WebP with a pure-Go encoder (builds run
// with CGO_ENABLED=0). Re-encoding drops every metadata block of the original, so EXIF
// (camera, GPS position, time) never reaches the published files.
package imaging

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	"image/draw"
	"image/jpeg"
	"image/png"
	"math"

	"github.com/deepteams/webp"
	xdraw "golang.org/x/image/draw"
	xwebp "golang.org/x/image/webp"
)

// Limits for decoding untrusted files: a small PNG can declare a gigapixel canvas.
const (
	MaxSide   = 10000
	MaxPixels = 40_000_000 // ~160 MB as RGBA while decoding; the media queue runs 2 at a time
)

var (
	ErrFormat   = errors.New("imaging: not a JPEG, PNG or WebP image")
	ErrTooLarge = fmt.Errorf("imaging: image larger than %d px on a side or %d pixels", MaxSide, MaxPixels)
)

// Format is the sniffed input type.
type Format string

const (
	JPEG Format = "jpeg"
	PNG  Format = "png"
	WebP Format = "webp"
)

// Sniff recognises the three accepted formats by their magic bytes.
func Sniff(b []byte) (Format, bool) {
	switch {
	case len(b) >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF:
		return JPEG, true
	case len(b) >= 8 && string(b[:8]) == "\x89PNG\r\n\x1a\n":
		return PNG, true
	case len(b) >= 12 && string(b[:4]) == "RIFF" && string(b[8:12]) == "WEBP":
		return WebP, true
	}
	return "", false
}

// Load decodes b, scales it so its longer side is at most side, and turns it upright
// (JPEG EXIF orientation). Everything else in the file (metadata, colour profiles,
// comments) is left behind.
func Load(b []byte, side int) (*image.RGBA, Format, error) {
	img, f, err := Decode(b)
	if err != nil {
		return nil, f, err
	}
	o := 1
	if f == JPEG {
		o = Orientation(b)
	}
	return Orient(Shrink(img, side), o), f, nil
}

// Decode checks the declared size first, then decodes the pixels as stored (see Load
// for the upright, bounded version).
func Decode(b []byte) (image.Image, Format, error) {
	f, ok := Sniff(b)
	if !ok {
		return nil, "", ErrFormat
	}
	var cfgFn func([]byte) (image.Config, error)
	var decFn func([]byte) (image.Image, error)
	switch f {
	case JPEG:
		cfgFn = func(b []byte) (image.Config, error) { return jpeg.DecodeConfig(bytes.NewReader(b)) }
		decFn = func(b []byte) (image.Image, error) { return jpeg.Decode(bytes.NewReader(b)) }
	case PNG:
		cfgFn = func(b []byte) (image.Config, error) { return png.DecodeConfig(bytes.NewReader(b)) }
		decFn = func(b []byte) (image.Image, error) { return png.Decode(bytes.NewReader(b)) }
	case WebP: // golang.org/x/image decodes; only encoding needs the other library
		cfgFn = func(b []byte) (image.Config, error) { return xwebp.DecodeConfig(bytes.NewReader(b)) }
		decFn = func(b []byte) (image.Image, error) { return xwebp.Decode(bytes.NewReader(b)) }
	}
	cfg, err := cfgFn(b)
	if err != nil {
		return nil, f, fmt.Errorf("imaging: %s header: %w", f, err)
	}
	if cfg.Width <= 0 || cfg.Height <= 0 || cfg.Width > MaxSide || cfg.Height > MaxSide ||
		cfg.Width*cfg.Height > MaxPixels {
		return nil, f, ErrTooLarge
	}
	img, err := decFn(b)
	if err != nil {
		return nil, f, fmt.Errorf("imaging: decode %s: %w", f, err)
	}
	return img, f, nil
}

// ---- geometry -------------------------------------------------------------------------------

// Pixels are processed as premultiplied RGBA: the resampler has fast paths for it and
// premultiplied alpha is the right space to filter transparent logos in.
func scale(src image.Image, sr image.Rectangle, w, h int) *image.RGBA {
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	xdraw.CatmullRom.Scale(dst, dst.Bounds(), src, sr, draw.Src, nil)
	return dst
}

// toRGBA converts (or returns) img as *image.RGBA with its origin at 0,0.
func toRGBA(img image.Image) *image.RGBA {
	if r, ok := img.(*image.RGBA); ok && r.Bounds().Min == (image.Point{}) {
		return r
	}
	b := img.Bounds()
	dst := image.NewRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	draw.Draw(dst, dst.Bounds(), img, b.Min, draw.Src)
	return dst
}

// Shrink returns src scaled down so its longer side is at most side (converted but not
// scaled if it already fits). Variants are made from this once instead of from a 40 MP
// original each.
func Shrink(src image.Image, side int) *image.RGBA {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	switch {
	case w <= side && h <= side:
		return toRGBA(src)
	case w >= h:
		return scale(src, b, side, max(1, h*side/w))
	default:
		return scale(src, b, max(1, w*side/h), side)
	}
}

// Square crops the centre square and scales it to size×size (avatars).
func Square(src image.Image, size int) *image.RGBA {
	b := src.Bounds()
	s := min(b.Dx(), b.Dy())
	x0 := b.Min.X + (b.Dx()-s)/2
	y0 := b.Min.Y + (b.Dy()-s)/2
	return scale(src, image.Rect(x0, y0, x0+s, y0+s), size, size)
}

// Fit scales src to fit inside a box×box square, keeping its aspect ratio and its
// transparency (logos are never cropped).
func Fit(src image.Image, box int) *image.RGBA {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w >= h {
		return scale(src, b, box, max(1, h*box/w))
	}
	return scale(src, b, max(1, w*box/h), box)
}

// Banner scales src to width w; images taller than maxAspect (height/width) are cropped
// to it around the centre first (covers are wide banners).
func Banner(src image.Image, w int, maxAspect float64) *image.RGBA {
	b := src.Bounds()
	sr := b
	h := max(1, int(math.Round(float64(b.Dy())*float64(w)/float64(b.Dx()))))
	if maxH := int(math.Round(float64(w) * maxAspect)); h > maxH {
		h = maxH
		keep := min(b.Dy(), int(math.Round(float64(maxH)*float64(b.Dx())/float64(w))))
		y0 := b.Min.Y + (b.Dy()-keep)/2
		sr = image.Rect(b.Min.X, y0, b.Max.X, y0+keep)
	}
	return scale(src, sr, w, h)
}

// Opaque reports whether every pixel is fully opaque.
func Opaque(img image.Image) bool {
	if o, ok := img.(interface{ Opaque() bool }); ok {
		return o.Opaque()
	}
	return false
}

// ---- encoding --------------------------------------------------------------------------------

// EncodeWebP encodes lossy WebP (with an alpha channel when the image has transparency).
func EncodeWebP(img image.Image, quality int) ([]byte, error) {
	var buf bytes.Buffer
	if err := webp.Encode(&buf, img, &webp.EncoderOptions{Quality: float32(quality), Method: 4}); err != nil {
		return nil, fmt.Errorf("imaging: encode webp: %w", err)
	}
	return buf.Bytes(), nil
}
