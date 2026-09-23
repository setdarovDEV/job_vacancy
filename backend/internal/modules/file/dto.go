package file

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
)

type DTO struct {
	ID          uuid.UUID       `json:"id"`
	Purpose     string          `json:"purpose"`
	Status      string          `json:"status"`
	ContentType string          `json:"content_type"`
	Size        int64           `json:"size"`
	Name        string          `json:"name"`
	Meta        json.RawMessage `json:"meta"`
	URL         string          `json:"url,omitempty"` // only when ready; signed URLs expire in 1h
	CreatedAt   time.Time       `json:"created_at"`
}

func (s *Service) DTO(ctx context.Context, f gen.File) (DTO, error) {
	d := DTO{ID: f.ID, Purpose: string(f.Purpose), Status: string(f.Status), ContentType: f.ContentType,
		Size: f.Size, Name: f.Name, Meta: f.Meta, CreatedAt: f.CreatedAt}
	if f.Status == gen.FileStatusReady {
		u, err := s.URL(ctx, f)
		if err != nil {
			return d, err
		}
		d.URL = u
	}
	return d, nil
}
