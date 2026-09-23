// Package cursor encodes keyset-pagination positions as opaque URL-safe strings.
// Clients just echo meta.next_cursor back; they never parse it.
package cursor

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

var ErrInvalid = errors.New("cursor: invalid")

// TimeID is a (timestamp, id) position, the key of most of our listings.
type TimeID struct {
	T  time.Time `json:"t"`
	ID uuid.UUID `json:"i"`
}

func Encode(v any) string {
	b, _ := json.Marshal(v)
	return base64.RawURLEncoding.EncodeToString(b)
}

func Decode(s string, v any) error {
	b, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return ErrInvalid
	}
	if err := json.Unmarshal(b, v); err != nil {
		return ErrInvalid
	}
	return nil
}

// Meta is the "meta" object of paginated responses.
type Meta struct {
	NextCursor *string `json:"next_cursor"`
}

// Page trims a result fetched with limit+1 rows and builds the next cursor from the last
// kept row. That extra row tells us whether another page exists without a COUNT(*).
func Page[T any](rows []T, limit int, key func(T) any) ([]T, Meta) {
	if len(rows) <= limit {
		return rows, Meta{}
	}
	rows = rows[:limit]
	c := Encode(key(rows[len(rows)-1]))
	return rows, Meta{NextCursor: &c}
}
