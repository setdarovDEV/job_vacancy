package imaging

import (
	"os"
	"testing"
)

// BenchmarkPipeline runs the avatar (3 squares) and cover (2 banners + LQIP) pipelines on
// a real photo: IMAGING_SAMPLE=/path/to/photo.jpg go test -bench Pipeline ./internal/pkg/imaging
func BenchmarkPipeline(b *testing.B) {
	path := os.Getenv("IMAGING_SAMPLE")
	if path == "" {
		b.Skip("set IMAGING_SAMPLE to a JPEG photo")
	}
	src, err := os.ReadFile(path)
	if err != nil {
		b.Fatal(err)
	}
	b.Run("avatar", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			img, _, err := Load(src, 512)
			if err != nil {
				b.Fatal(err)
			}
			for _, s := range []int{256, 128, 64} {
				if _, err := EncodeWebP(Square(img, s), 82); err != nil {
					b.Fatal(err)
				}
			}
		}
	})
	b.Run("cover", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			img, _, err := Load(src, 2560)
			if err != nil {
				b.Fatal(err)
			}
			for _, w := range []int{1280, 640, 24} {
				if _, err := EncodeWebP(Banner(img, w, 9.0/16), 80); err != nil {
					b.Fatal(err)
				}
			}
		}
	})
}
