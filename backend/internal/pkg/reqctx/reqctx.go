// Package reqctx carries per-request values (request id, client ip, authenticated user)
// through context.Context.
package reqctx

import (
	"context"
	"net/netip"

	"github.com/google/uuid"
)

type ctxKey int

const (
	keyRequestID ctxKey = iota
	keyClientIP
	keyPrincipal
)

// Principal is the authenticated caller, taken from a verified access token.
type Principal struct {
	UserID    uuid.UUID
	SessionID uuid.UUID
	Role      string
}

func WithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, keyRequestID, id)
}

func RequestID(ctx context.Context) string {
	s, _ := ctx.Value(keyRequestID).(string)
	return s
}

func WithClientIP(ctx context.Context, ip netip.Addr) context.Context {
	return context.WithValue(ctx, keyClientIP, ip)
}

// ClientIP returns the caller's address, or an invalid Addr if unknown.
func ClientIP(ctx context.Context) netip.Addr {
	ip, _ := ctx.Value(keyClientIP).(netip.Addr)
	return ip
}

func WithPrincipal(ctx context.Context, p Principal) context.Context {
	return context.WithValue(ctx, keyPrincipal, p)
}

func PrincipalFrom(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(keyPrincipal).(Principal)
	return p, ok
}

// MustPrincipal is for handlers mounted behind RequireAuth.
func MustPrincipal(ctx context.Context) Principal {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		panic("reqctx: no principal in context; route is missing RequireAuth")
	}
	return p
}
