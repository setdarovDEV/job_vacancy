package vacancy

import (
	"github.com/google/uuid"
	"github.com/riverqueue/river"
)

// ReindexArgs asks the worker to rebuild the search documents of some vacancies (after a
// skill merge, TZ FN-01) and drop their cached pages.
type ReindexArgs struct {
	IDs []uuid.UUID `json:"ids"`
}

func (ReindexArgs) Kind() string { return "vacancy.reindex" }

func (ReindexArgs) InsertOpts() river.InsertOpts { return river.InsertOpts{MaxAttempts: 5} }
