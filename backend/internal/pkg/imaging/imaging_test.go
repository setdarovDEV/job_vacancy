package imaging

import (
	"bytes"
	"encoding/binary"
	"errors"
	"hash/crc32"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"

	xwebp "golang.org/x/image/webp"
)

// exifAPP1 builds an APP1 segment with IFD0 {Orientation, GPSInfo → GPS IFD with a
// latitude}, the way phones write them.
func exifAPP1(orientation uint16) []byte {
	le := binary.LittleEndian
	var t bytes.Buffer
	t.WriteString("II")
	_ = binary.Write(&t, le, uint16(42))
	_ = binary.Write(&t, le, uint32(8)) // IFD0 at 8
	entry := func(tag, typ uint16, count, value uint32) {
		_ = binary.Write(&t, le, tag)
		_ = binary.Write(&t, le, typ)
		_ = binary.Write(&t, le, count)
		_ = binary.Write(&t, le, value)
	}
	_ = binary.Write(&t, le, uint16(2))
	entry(0x0112, 3, 1, uint32(orientation)) // Orientation (SHORT, left-justified)
	gpsIFD := uint32(8 + 2 + 2*12 + 4)
	entry(0x8825, 4, 1, gpsIFD) // GPSInfo
	_ = binary.Write(&t, le, uint32(0))
	_ = binary.Write(&t, le, uint16(2))
	latOff := gpsIFD + 2 + 2*12 + 4
	entry(0x0001, 2, 2, uint32('N'))    // GPSLatitudeRef
	entry(0x0002, 5, 3, latOff)         // GPSLatitude (3 rationals)
	_ = binary.Write(&t, le, uint32(0)) // no next IFD
	for _, v := range []uint32{41, 1, 18, 1, 4567, 100} {
		_ = binary.Write(&t, le, v)
	}
	payload := append([]byte("Exif\x00\x00"), t.Bytes()...)
	seg := []byte{0xFF, 0xE1, 0, 0}
	binary.BigEndian.PutUint16(seg[2:], uint16(len(payload)+2))
	return append(seg, payload...)
}

// photo is a 40×20 JPEG, left half red, right half blue, with EXIF orientation and GPS.
func photo(t *testing.T, orientation uint16) []byte {
	img := image.NewRGBA(image.Rect(0, 0, 40, 20))
	for y := 0; y < 20; y++ {
		for x := 0; x < 40; x++ {
			c := color.RGBA{220, 20, 20, 255}
			if x >= 20 {
				c = color.RGBA{20, 20, 220, 255}
			}
			img.Set(x, y, c)
		}
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 95}); err != nil {
		t.Fatal(err)
	}
	b := buf.Bytes()
	return append(append(append([]byte{}, b[:2]...), exifAPP1(orientation)...), b[2:]...)
}

func isRed(c color.Color) bool  { r, _, b, _ := c.RGBA(); return r > 3*b }
func isBlue(c color.Color) bool { r, _, b, _ := c.RGBA(); return b > 3*r }

// TZ BE-14 / SEC-06 ✅ "GPS EXIF qolmaydi": a phone photo with GPS coordinates comes out
// upright (orientation 6 applied) and its WebP variants carry no EXIF, GPS or XMP.
func TestPhotoLosesGPSAndStaysUpright(t *testing.T) {
	src := photo(t, 6)
	if Orientation(src) != 6 || !bytes.Contains(src, []byte("Exif")) {
		t.Fatal("fixture has no EXIF orientation")
	}
	img, f, err := Load(src, 2560)
	if err != nil || f != JPEG {
		t.Fatal(f, err)
	}
	if b := img.Bounds(); b.Dx() != 20 || b.Dy() != 40 {
		t.Fatalf("rotated size %v, want 20×40", b)
	}
	// Rotated 90° clockwise: the left (red) half is now on top.
	if !isRed(img.At(10, 5)) || !isBlue(img.At(10, 35)) {
		t.Fatalf("not upright: top %v bottom %v", img.At(10, 5), img.At(10, 35))
	}
	out, err := EncodeWebP(Square(img, 64), 82)
	if err != nil {
		t.Fatal(err)
	}
	for _, leak := range []string{"Exif", "EXIF", "XMP ", "GPS", "II*\x00"} {
		if bytes.Contains(out, []byte(leak)) {
			t.Fatalf("output contains %q", leak)
		}
	}
	for _, chunk := range chunks(t, out) {
		if chunk != "VP8 " && chunk != "VP8L" && chunk != "VP8X" && chunk != "ALPH" {
			t.Fatalf("unexpected WebP chunk %q", chunk)
		}
	}
	dec, err := xwebp.Decode(bytes.NewReader(out))
	if err != nil {
		t.Fatal("variant doesn't decode with golang.org/x/image/webp:", err)
	}
	if dec.Bounds().Dx() != 64 || dec.Bounds().Dy() != 64 {
		t.Fatalf("variant %v", dec.Bounds())
	}
}

// chunks lists the RIFF chunk FourCCs of a WebP file.
func chunks(t *testing.T, b []byte) []string {
	if len(b) < 12 || string(b[:4]) != "RIFF" || string(b[8:12]) != "WEBP" {
		t.Fatal("not a WebP file")
	}
	var out []string
	for i := 12; i+8 <= len(b); {
		out = append(out, string(b[i:i+4]))
		n := int(binary.LittleEndian.Uint32(b[i+4:]))
		i += 8 + n + n%2
	}
	return out
}

func TestOrientations(t *testing.T) {
	// 3×2 image with a distinct value per pixel.
	src := image.NewRGBA(image.Rect(0, 0, 3, 2))
	for i := range src.Pix {
		src.Pix[i] = byte(i / 4)
	}
	px := func(img *image.RGBA, x, y int) byte { return img.Pix[y*img.Stride+x*4] }
	// Where the top-left source pixel (value 0) ends up for each orientation.
	want := map[int][2]int{1: {0, 0}, 2: {2, 0}, 3: {2, 1}, 4: {0, 1}, 5: {0, 0}, 6: {1, 0}, 7: {1, 2}, 8: {0, 2}}
	for o, at := range want {
		got := Orient(src, o)
		if px(got, at[0], at[1]) != 0 {
			t.Errorf("orientation %d: pixel 0 not at %v", o, at)
		}
		if w := got.Bounds().Dx(); (o >= 5) != (w == 2) {
			t.Errorf("orientation %d: width %d", o, w)
		}
	}
}

// A small PNG that declares a 20000×20000 canvas is refused before any pixel memory is
// allocated (decompression bomb).
func TestDecompressionBomb(t *testing.T) {
	var buf bytes.Buffer
	_ = png.Encode(&buf, image.NewGray(image.Rect(0, 0, 1, 1)))
	b := buf.Bytes()
	ihdr := b[8:33] // length(4) "IHDR"(4) data(13) crc(4)
	binary.BigEndian.PutUint32(ihdr[8:], 20000)
	binary.BigEndian.PutUint32(ihdr[12:], 20000)
	binary.BigEndian.PutUint32(ihdr[21:], crc32.ChecksumIEEE(ihdr[4:21]))
	if _, _, err := Decode(b); !errors.Is(err, ErrTooLarge) {
		t.Fatalf("bomb: %v", err)
	}
	if _, _, err := Decode([]byte("<svg xmlns='http://www.w3.org/2000/svg'/>")); !errors.Is(err, ErrFormat) {
		t.Fatalf("svg: %v", err)
	}
}

// Logos keep their transparency and aspect ratio; covers are cropped to 16:9 at most.
func TestLogoAndCoverGeometry(t *testing.T) {
	logo := image.NewNRGBA(image.Rect(0, 0, 400, 100)) // transparent, a solid bar in the middle
	for y := 40; y < 60; y++ {
		for x := 0; x < 400; x++ {
			logo.Set(x, y, color.NRGBA{27, 58, 140, 255})
		}
	}
	var buf bytes.Buffer
	_ = png.Encode(&buf, logo)
	img, f, err := Load(buf.Bytes(), 2560)
	if err != nil || f != PNG {
		t.Fatal(f, err)
	}
	fit := Fit(img, 256)
	if fit.Bounds().Dx() != 256 || fit.Bounds().Dy() != 64 {
		t.Fatalf("logo fit %v, want 256×64", fit.Bounds())
	}
	out, err := EncodeWebP(fit, 90)
	if err != nil {
		t.Fatal(err)
	}
	dec, err := xwebp.Decode(bytes.NewReader(out))
	if err != nil {
		t.Fatal(err)
	}
	if _, _, _, a := dec.At(5, 2).RGBA(); a != 0 {
		t.Fatalf("transparent corner has alpha %d", a>>8)
	}
	if _, _, _, a := dec.At(128, 32).RGBA(); a < 0xF000 {
		t.Fatalf("logo bar lost its opacity (alpha %d)", a>>8)
	}

	tall := image.NewRGBA(image.Rect(0, 0, 1000, 3000))
	if b := Banner(tall, 1280, 9.0/16).Bounds(); b.Dx() != 1280 || b.Dy() != 720 {
		t.Fatalf("cover %v, want 1280×720", b)
	}
	if b := Banner(image.NewRGBA(image.Rect(0, 0, 3000, 1000)), 640, 9.0/16).Bounds(); b.Dx() != 640 || b.Dy() != 213 {
		t.Fatalf("wide cover %v, want 640×213", b)
	}
}
