// Package media turns uploaded avatars, company logos and covers into published image
// variants (TZ BE-14, SEC-06).
//
// The upload itself stays private: the owner's choice is recorded (users.avatar_file_id,
// companies.logo_file_id / cover_file_id) and a media.process job is queued in the same
// transaction. The worker (package media/process) decodes the original, turns it
// upright, re-encodes WebP variants without any metadata into the public bucket, swaps the
// shown URL if the choice still holds, deletes the original and schedules the previous
// image's files for deletion.
//
// Variant keys and the sizes each DTO lists are in package imgurl.
package media

import (
	"time"

	"github.com/google/uuid"
	"github.com/riverqueue/river"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/file"
	"jobvacancy.uz/backend/internal/pkg/imgurl"
)

// Purpose is the upload purpose an image for t must have.
func Purpose(t imgurl.Target) gen.FilePurpose {
	switch t {
	case imgurl.Logo:
		return gen.FilePurposeCompanyLogo
	case imgurl.Cover:
		return gen.FilePurposeCompanyCover
	}
	return gen.FilePurposeAvatar
}

// Queue runs image jobs; its small concurrency bounds the memory of decoding (a 40 MP
// photo takes ~160 MB while it's resized).
const Queue = "media"

// ProcessArgs asks the worker to publish variants of an uploaded image.
type ProcessArgs struct {
	FileID  uuid.UUID     `json:"file_id"`
	Target  imgurl.Target `json:"target"`
	OwnerID uuid.UUID     `json:"owner_id"` // the user (avatar) or the company (logo, cover)
}

func (ProcessArgs) Kind() string { return "media.process" }

func (ProcessArgs) InsertOpts() river.InsertOpts {
	return river.InsertOpts{Queue: Queue, MaxAttempts: 5}
}

// RetireDelay keeps a replaced image's files around for a while: cached pages (API cache,
// nginx micro-cache, browsers) may still point at them.
const RetireDelay = time.Hour

// RetireArgs deletes a replaced image: its objects, then the upload rows.
type RetireArgs struct {
	Objects []file.StoredObject `json:"objects"`
	FileIDs []uuid.UUID         `json:"file_ids"`
}

func (RetireArgs) Kind() string { return "media.retire" }

func (RetireArgs) InsertOpts() river.InsertOpts {
	return river.InsertOpts{Queue: Queue, MaxAttempts: 10, ScheduledAt: time.Now().Add(RetireDelay)}
}

// DoneChannel is where the worker announces a finished (or failed) upload, so the request
// that chose it can answer with the new image.
func DoneChannel(fileID uuid.UUID) string { return "media:done:" + fileID.String() }
