// Package audit records admin actions (TZ FN-01): who did what to which object, from which
// IP, with the action's details. Rows are written inside the action's own transaction, so
// an action and its audit entry commit or roll back together.
package audit

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
)

// Object types.
const (
	ObjectUser       = "user"
	ObjectCompany    = "company"
	ObjectVacancy    = "vacancy"
	ObjectSkill      = "skill"
	ObjectReport     = "report"
	ObjectSearchTerm = "search_term"
)

// Entry is one admin action.
type Entry struct {
	Action     string // e.g. "user.block"
	ObjectType string
	ObjectID   string
	// Details is stored as JSON (reason, counts, affected ids); nil stores {}.
	Details any
}

// Write inserts e with q, which must be bound to the action's transaction. The admin and
// the client IP are taken from the request context.
func Write(ctx context.Context, q *gen.Queries, e Entry) error {
	details := []byte("{}")
	if e.Details != nil {
		b, err := json.Marshal(e.Details)
		if err != nil {
			return fmt.Errorf("audit details: %w", err)
		}
		details = b
	}
	p := gen.InsertAuditLogParams{Action: e.Action, ObjectType: e.ObjectType, ObjectID: e.ObjectID, Details: details}
	if pr, ok := reqctx.PrincipalFrom(ctx); ok && pr.UserID != uuid.Nil {
		id := pr.UserID
		p.AdminID = &id
	}
	if ip := reqctx.ClientIP(ctx); ip.IsValid() {
		p.Ip = &ip
	}
	if err := q.InsertAuditLog(ctx, p); err != nil {
		return fmt.Errorf("audit log: %w", err)
	}
	return nil
}
