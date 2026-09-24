package auth

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/jobs"
	"jobvacancy.uz/backend/internal/pkg/otp"
	"jobvacancy.uz/backend/internal/pkg/token"
	"jobvacancy.uz/backend/internal/testutil/fixture"
)

type noMail struct{}

func (noMail) EnqueueEmailCode(context.Context, jobs.EmailCodeArgs) error { return nil }

// TZ FN-08: an account is created only with consent to the processing of personal data;
// the policy version and the time are stored.
func TestRegisterRequiresConsent(t *testing.T) {
	w := fixture.New(t)
	_, rdb := fixture.Redis(t)
	svc := &Service{Q: w.Q, Tokens: token.NewManager(strings.Repeat("s", 40), "t", time.Minute),
		OTP: otp.NewStore(rdb, strings.Repeat("o", 40)), Revoked: NewRevocationStore(rdb, time.Minute),
		Emails: noMail{}, RefreshTTL: time.Hour, ConsentVersion: "2026-09-24", Log: w.Log}
	ctx := context.Background()
	in := RegisterInput{Email: w.Email(), Password: "Secret123", FullName: "Ali", Role: gen.UserRoleSeeker, Locale: gen.AppLocaleUz}

	if _, err := svc.Register(ctx, in, ClientMeta{}); !errors.Is(err, ErrConsentRequired) {
		t.Fatalf("no consent: %v", err)
	}
	in.Consent = Consent{Given: true, Version: "2025-01-01"}
	if _, err := svc.Register(ctx, in, ClientMeta{}); !errors.Is(err, ErrConsentOutdated) {
		t.Fatalf("old version: %v", err)
	}
	if n := w.Int(`SELECT count(*) FROM users WHERE email = $1`, in.Email); n != 0 {
		t.Fatal("an account was created without consent")
	}
	in.Consent = Consent{Given: true}
	before := time.Now().Add(-time.Second)
	res, err := svc.Register(ctx, in, ClientMeta{})
	if err != nil {
		t.Fatal(err)
	}
	u := res.User
	if u.ConsentVersion == nil || *u.ConsentVersion != "2026-09-24" || u.ConsentAt == nil || u.ConsentAt.Before(before) {
		t.Fatalf("consent stored as %v at %v", u.ConsentVersion, u.ConsentAt)
	}

	// A policy update: the user accepts the new version.
	svc.ConsentVersion = "2027-01-01"
	if _, err := svc.AcceptConsent(ctx, u.ID, "2026-09-24"); !errors.Is(err, ErrConsentOutdated) {
		t.Fatalf("accepting an old version: %v", err)
	}
	u, err = svc.AcceptConsent(ctx, u.ID, "")
	if err != nil || *u.ConsentVersion != "2027-01-01" {
		t.Fatalf("accept current: %v %v", u.ConsentVersion, err)
	}
}
