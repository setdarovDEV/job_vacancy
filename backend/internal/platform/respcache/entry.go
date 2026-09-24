package respcache

import (
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"sync"
	"time"
)

// Entry is one cached response: the final JSON body stored gzip-compressed, its ETag and
// a little opaque metadata for the caller (e.g. the vacancy id behind a slug).
type Entry struct {
	ETag       string
	Gzip       []byte // gzip-compressed response body
	Meta       []byte
	Gen        int64     // namespace generation the entry was loaded under
	FreshUntil time.Time // after this it is served stale while one instance refreshes it
}

// Binary layout in Redis (all integers big-endian):
//
//	magic 'J' | version | fresh_until unix ms (8) | gen (8) | etag len (1) | etag |
//	meta len (2) | meta | gzip body
const (
	magic      byte = 'J'
	version    byte = 1
	headerSize      = 2 + 8 + 8 + 1
)

var errCorrupt = errors.New("respcache: corrupt entry")

func (e *Entry) encode() []byte {
	b := make([]byte, 0, headerSize+len(e.ETag)+2+len(e.Meta)+len(e.Gzip))
	b = append(b, magic, version)
	b = binary.BigEndian.AppendUint64(b, uint64(e.FreshUntil.UnixMilli()))
	b = binary.BigEndian.AppendUint64(b, uint64(e.Gen))
	b = append(b, byte(len(e.ETag)))
	b = append(b, e.ETag...)
	b = binary.BigEndian.AppendUint16(b, uint16(len(e.Meta)))
	b = append(b, e.Meta...)
	return append(b, e.Gzip...)
}

func decode(raw []byte) (*Entry, error) {
	if len(raw) < headerSize || raw[0] != magic || raw[1] != version {
		return nil, errCorrupt
	}
	e := &Entry{
		FreshUntil: time.UnixMilli(int64(binary.BigEndian.Uint64(raw[2:10]))),
		Gen:        int64(binary.BigEndian.Uint64(raw[10:18])),
	}
	rest := raw[headerSize:]
	n := int(raw[headerSize-1])
	if len(rest) < n+2 {
		return nil, errCorrupt
	}
	e.ETag, rest = string(rest[:n]), rest[n:]
	m := int(binary.BigEndian.Uint16(rest[:2]))
	rest = rest[2:]
	if len(rest) < m {
		return nil, errCorrupt
	}
	if m > 0 {
		e.Meta = rest[:m]
	}
	e.Gzip = rest[m:]
	return e, nil
}

// etagOf is a weak validator of the uncompressed body: the same bytes may be sent gzipped
// or plain, so it can't be a strong one (RFC 9110 §8.8.1).
func etagOf(body []byte) string {
	sum := sha256.Sum256(body)
	return `W/"` + base64.RawURLEncoding.EncodeToString(sum[:12]) + `"`
}

var gzipWriters = sync.Pool{New: func() any {
	w, _ := gzip.NewWriterLevel(nil, gzip.DefaultCompression)
	return w
}}

// compress gzips body once per load; every hit then reuses the compressed bytes.
func compress(body []byte) ([]byte, error) {
	var buf bytes.Buffer
	buf.Grow(len(body)/4 + 64)
	zw := gzipWriters.Get().(*gzip.Writer)
	defer gzipWriters.Put(zw)
	zw.Reset(&buf)
	if _, err := zw.Write(body); err != nil {
		return nil, err
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
