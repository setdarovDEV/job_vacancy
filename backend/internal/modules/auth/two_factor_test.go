package auth

import (
	"context"
	"errors"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/hash"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/pkg/sealbox"
	"jobvacancy.uz/backend/internal/pkg/totp"
)

// ---- fakes ---------------------------------------------------------------------------------

type fakeStore struct {
	user     gen.User
	totp     *gen.UserTotp
	codes    map[string]bool // recovery hash → used
	sessions map[uuid.UUID]bool
	revoked  []uuid.UUID
	failWith error // returned by every read
}

func newFakeStore(u gen.User) *fakeStore {
	return &fakeStore{user: u, codes: map[string]bool{}, sessions: map[uuid.UUID]bool{}}
}

func (s *fakeStore) GetUserByID(context.Context, uuid.UUID) (gen.User, error) {
	return s.user, s.failWith
}

func (s *fakeStore) GetUserTOTP(context.Context, uuid.UUID) (gen.UserTotp, error) {
	if s.failWith != nil {
		return gen.UserTotp{}, s.failWith
	}
	if s.totp == nil {
		return gen.UserTotp{}, pgx.ErrNoRows
	}
	return *s.totp, nil
}

func (s *fakeStore) IsTOTPEnabled(context.Context, uuid.UUID) (bool, error) {
	return s.totp != nil && s.totp.ConfirmedAt != nil, s.failWith
}

func (s *fakeStore) UpsertPendingTOTP(_ context.Context, a gen.UpsertPendingTOTPParams) (gen.UserTotp, error) {
	if s.totp != nil && s.totp.ConfirmedAt != nil {
		return gen.UserTotp{}, pgx.ErrNoRows
	}
	s.totp = &gen.UserTotp{UserID: a.UserID, SecretEnc: a.SecretEnc}
	return *s.totp, nil
}

func (s *fakeStore) UseTOTPStep(_ context.Context, a gen.UseTOTPStepParams) (int64, error) {
	if s.totp == nil || s.totp.LastStep >= a.LastStep {
		return 0, nil
	}
	s.totp.LastStep = a.LastStep
	return 1, nil
}

func (s *fakeStore) UseRecoveryCode(_ context.Context, a gen.UseRecoveryCodeParams) (int64, error) {
	used, ok := s.codes[string(a.CodeHash)]
	if !ok || used {
		return 0, nil
	}
	s.codes[string(a.CodeHash)] = true
	return 1, nil
}

func (s *fakeStore) CountRecoveryCodesLeft(context.Context, uuid.UUID) (int32, error) {
	n := int32(0)
	for _, used := range s.codes {
		if !used {
			n++
		}
	}
	return n, nil
}

func (s *fakeStore) SecondFactorState(_ context.Context, a gen.SecondFactorStateParams) (gen.SecondFactorStateRow, error) {
	if s.failWith != nil {
		return gen.SecondFactorStateRow{}, s.failWith
	}
	return gen.SecondFactorStateRow{Enabled: s.totp != nil && s.totp.ConfirmedAt != nil, SessionVerified: s.sessions[a.SessionID]}, nil
}

func (s *fakeStore) InTx(_ context.Context, fn func(TwoFactorTx) error) error { return fn(s) }

func (s *fakeStore) ConfirmTOTP(_ context.Context, a gen.ConfirmTOTPParams) (gen.UserTotp, error) {
	now := time.Now()
	s.totp.ConfirmedAt, s.totp.LastStep = &now, a.LastStep
	return *s.totp, nil
}

func (s *fakeStore) InsertConfirmedTOTP(_ context.Context, a gen.InsertConfirmedTOTPParams) error {
	now := time.Now()
	s.totp = &gen.UserTotp{UserID: a.UserID, SecretEnc: a.SecretEnc, ConfirmedAt: &now}
	return nil
}

func (s *fakeStore) DeleteTOTP(context.Context, uuid.UUID) error { s.totp = nil; return nil }

func (s *fakeStore) DeleteRecoveryCodes(context.Context, uuid.UUID) error {
	s.codes = map[string]bool{}
	return nil
}

func (s *fakeStore) InsertRecoveryCodes(_ context.Context, a gen.InsertRecoveryCodesParams) error {
	for _, h := range a.Hashes {
		s.codes[string(h)] = false
	}
	return nil
}

func (s *fakeStore) MarkSessionSecondFactor(_ context.Context, a gen.MarkSessionSecondFactorParams) (int64, error) {
	s.sessions[a.ID] = true
	return 1, nil
}

func (s *fakeStore) RevokeOtherUserSessions(_ context.Context, a gen.RevokeOtherUserSessionsParams) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	for id := range s.sessions {
		if id != a.Keep {
			ids = append(ids, id)
			delete(s.sessions, id)
		}
	}
	s.revoked = append(s.revoked, ids...)
	return ids, nil
}

func (s *fakeStore) RevokeAllUserSessions(context.Context, uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	for id := range s.sessions {
		ids = append(ids, id)
	}
	s.sessions = map[uuid.UUID]bool{}
	s.revoked = append(s.revoked, ids...)
	return ids, nil
}

type fakeChallenges struct{ users map[string]uuid.UUID }

func (c *fakeChallenges) Create(_ context.Context, id uuid.UUID, now time.Time) (Challenge, error) {
	c.users["t"] = id
	return Challenge{Token: "t", ExpiresAt: now.Add(challengeTTL)}, nil
}

func (c *fakeChallenges) Attempt(_ context.Context, token string) (uuid.UUID, error) {
	id, ok := c.users[token]
	if !ok {
		return uuid.Nil, ErrTwoFactorChallenge
	}
	return id, nil
}

func (c *fakeChallenges) Consume(_ context.Context, token string) bool {
	_, ok := c.users[token]
	delete(c.users, token)
	return ok
}

// fakeBudget mirrors FailureBudget: reserve counts, release gives back.
type fakeBudget struct{ n int }

func (b *fakeBudget) Reserve(context.Context, uuid.UUID) error {
	if b.n >= maxCodeFailures {
		return apperr.TooManyRequests(60)
	}
	b.n++
	return nil
}

func (b *fakeBudget) Release(context.Context, uuid.UUID) {
	if b.n > 0 {
		b.n--
	}
}

type fakeRevoker struct{ ids []uuid.UUID }

func (r *fakeRevoker) Revoke(_ context.Context, ids ...uuid.UUID) error {
	r.ids = append(r.ids, ids...)
	return nil
}

// ---- harness -------------------------------------------------------------------------------

type tfHarness struct {
	sf       *SecondFactor
	store    *fakeStore
	budget   *fakeBudget
	revoker  *fakeRevoker
	clock    time.Time
	secret   []byte
	codes    []string
	admin    reqctx.Principal
	password string
}

func newHarness(t *testing.T) *tfHarness {
	t.Helper()
	box, err := sealbox.New([]byte("0123456789abcdef0123456789abcdef"), "totp")
	if err != nil {
		t.Fatal(err)
	}
	pw, _ := hash.Password("Secret123")
	email := "a@example.com"
	u := gen.User{ID: uuid.New(), Role: gen.UserRoleAdmin, Email: &email, PasswordHash: &pw}
	h := &tfHarness{store: newFakeStore(u), budget: &fakeBudget{}, revoker: &fakeRevoker{},
		clock: time.Unix(1_800_000_000, 0), password: "Secret123",
		admin: reqctx.Principal{UserID: u.ID, SessionID: uuid.New(), Role: "admin"}}
	h.sf = &SecondFactor{
		Store: h.store, Box: box, Challenges: &fakeChallenges{users: map[string]uuid.UUID{}},
		Failures: h.budget, Sessions: h.revoker, Issuer: "Test", AdminRequired: true,
		Now: func() time.Time { return h.clock },
	}
	return h
}

// enroll turns 2FA on through setup + confirm in the admin's current session.
func (h *tfHarness) enroll(t *testing.T) {
	t.Helper()
	en, err := h.sf.Setup(context.Background(), h.admin.UserID)
	if err != nil {
		t.Fatal(err)
	}
	h.secret, _ = totp.Decode(en.Secret)
	h.store.sessions[h.admin.SessionID] = false
	codes, err := h.sf.Confirm(context.Background(), h.admin, h.code())
	if err != nil {
		t.Fatal(err)
	}
	h.codes = codes
	h.tick()
}

func (h *tfHarness) code() string { return totp.Code(h.secret, totp.Step(h.clock)) }
func (h *tfHarness) tick()        { h.clock = h.clock.Add(30 * time.Second) }

func isCode(err error, code string) bool {
	var ae *apperr.Error
	return errors.As(err, &ae) && ae.Code == code
}

// ---- tests ---------------------------------------------------------------------------------

func TestTOTPStepReplayRefused(t *testing.T) {
	h := newHarness(t)
	h.enroll(t)
	ctx := context.Background()
	c := h.code()
	if err := h.sf.Verify(ctx, h.admin.UserID, c, ""); err != nil {
		t.Fatalf("fresh code: %v", err)
	}
	if err := h.sf.Verify(ctx, h.admin.UserID, c, ""); !errors.Is(err, ErrTwoFactorCodeInvalid) {
		t.Fatalf("replayed code: %v", err)
	}
	h.tick()
	if err := h.sf.Verify(ctx, h.admin.UserID, h.code(), ""); err != nil {
		t.Fatalf("next step: %v", err)
	}
}

func TestRecoveryCodeSingleUse(t *testing.T) {
	h := newHarness(t)
	h.enroll(t)
	ctx := context.Background()
	if len(h.codes) != recoveryCodeCount {
		t.Fatalf("got %d codes", len(h.codes))
	}
	if err := h.sf.Verify(ctx, h.admin.UserID, "", h.codes[0]); err != nil {
		t.Fatalf("first use: %v", err)
	}
	if err := h.sf.Verify(ctx, h.admin.UserID, "", h.codes[0]); !errors.Is(err, ErrTwoFactorCodeInvalid) {
		t.Fatalf("second use: %v", err)
	}
}

func TestFailureBudgetGives429AndRightAnswersDontCount(t *testing.T) {
	h := newHarness(t)
	h.enroll(t)
	ctx := context.Background()
	for i := 0; i < 5; i++ { // right answers are released
		h.tick()
		if err := h.sf.Verify(ctx, h.admin.UserID, h.code(), ""); err != nil {
			t.Fatal(err)
		}
	}
	if h.budget.n != 0 {
		t.Fatalf("budget used by right codes: %d", h.budget.n)
	}
	for i := 0; i < maxCodeFailures; i++ {
		if err := h.sf.Verify(ctx, h.admin.UserID, "000000", ""); !errors.Is(err, ErrTwoFactorCodeInvalid) {
			t.Fatalf("wrong code %d: %v", i, err)
		}
	}
	h.tick()
	if err := h.sf.Verify(ctx, h.admin.UserID, h.code(), ""); !isCode(err, "rate_limited") && !isTooMany(err) {
		t.Fatalf("after the budget: %v", err)
	}
}

func isTooMany(err error) bool {
	var ae *apperr.Error
	return errors.As(err, &ae) && ae.Status == http.StatusTooManyRequests
}

func TestChallengeIsSingleUse(t *testing.T) {
	h := newHarness(t)
	h.enroll(t)
	ctx := context.Background()
	ch, _ := h.sf.StartChallenge(ctx, h.admin.UserID)
	if _, err := h.sf.CompleteChallenge(ctx, ch.Token, h.code(), ""); err != nil {
		t.Fatal(err)
	}
	h.tick()
	if _, err := h.sf.CompleteChallenge(ctx, ch.Token, h.code(), ""); !errors.Is(err, ErrTwoFactorChallenge) {
		t.Fatalf("reused challenge: %v", err)
	}
}

func TestConfirmVerifiesThisSessionAndSignsOutOthers(t *testing.T) {
	h := newHarness(t)
	other := uuid.New()
	h.store.sessions[other] = false
	h.enroll(t)
	if !h.store.sessions[h.admin.SessionID] {
		t.Fatal("current session not marked as verified")
	}
	if _, ok := h.store.sessions[other]; ok || len(h.revoker.ids) != 1 || h.revoker.ids[0] != other {
		t.Fatalf("other session not revoked: store=%v revoker=%v", h.store.sessions, h.revoker.ids)
	}
}

func TestAdminGate(t *testing.T) {
	ctx := context.Background()
	h := newHarness(t)
	if err := h.sf.AdminAccess(ctx, h.admin); !errors.Is(err, ErrTwoFactorSetupRequired) {
		t.Fatalf("not enrolled, required: %v", err)
	}
	h.sf.AdminRequired = false
	if err := h.sf.AdminAccess(ctx, h.admin); err != nil {
		t.Fatalf("not enrolled, not required: %v", err)
	}
	h.enroll(t)
	if err := h.sf.AdminAccess(ctx, h.admin); err != nil {
		t.Fatalf("enrolled in this session: %v", err)
	}
	old := reqctx.Principal{UserID: h.admin.UserID, SessionID: uuid.New(), Role: "admin"}
	if err := h.sf.AdminAccess(ctx, old); !errors.Is(err, ErrTwoFactorSession) {
		t.Fatalf("session without a second factor: %v", err)
	}
	h.store.failWith = errors.New("db down")
	if err := h.sf.AdminAccess(ctx, h.admin); err == nil {
		t.Fatal("lookup failure must refuse")
	}
}

func TestSignInRefusesWhenTwoFactorLookupFails(t *testing.T) {
	h := newHarness(t)
	h.store.failWith = errors.New("db down")
	s := &Service{MFA: h.sf}
	res, err := s.signIn(context.Background(), h.store.user, ClientMeta{})
	if err == nil || res != nil {
		t.Fatalf("got res=%v err=%v; want a refusal", res, err)
	}
}

func TestReauthIsNotAPasswordOracle(t *testing.T) {
	h := newHarness(t)
	h.enroll(t)
	ctx := context.Background()
	wrongPw := Reauth{Password: "nope", Code: h.code()}
	wrongCode := Reauth{Password: h.password, Code: "000000"}
	_, err1 := h.sf.RegenerateRecoveryCodes(ctx, h.admin.UserID, wrongPw)
	_, err2 := h.sf.RegenerateRecoveryCodes(ctx, h.admin.UserID, wrongCode)
	if !errors.Is(err1, ErrReauthFailed) || !errors.Is(err2, ErrReauthFailed) {
		t.Fatalf("want reauth_failed for both: %v / %v", err1, err2)
	}
	if h.budget.n != 2 {
		t.Fatalf("wrong password and wrong code should both count: %d", h.budget.n)
	}
	for i := 2; i < maxCodeFailures; i++ {
		_, _ = h.sf.RegenerateRecoveryCodes(ctx, h.admin.UserID, wrongPw)
	}
	if _, err := h.sf.RegenerateRecoveryCodes(ctx, h.admin.UserID, Reauth{Password: h.password, Code: h.code()}); !isTooMany(err) {
		t.Fatalf("after the budget even the right answer is refused: %v", err)
	}
}

func TestReauthWithRecoveryCodeThenDisableSignsOutOthers(t *testing.T) {
	h := newHarness(t)
	h.enroll(t)
	other := uuid.New()
	h.store.sessions[other] = true
	ctx := context.Background()
	if err := h.sf.Disable(ctx, h.admin, Reauth{Password: h.password, Recovery: h.codes[3]}); err != nil {
		t.Fatal(err)
	}
	if h.store.totp != nil || len(h.store.codes) != 0 {
		t.Fatal("2FA still on")
	}
	if _, ok := h.store.sessions[other]; ok {
		t.Fatal("other session kept")
	}
	if _, ok := h.store.sessions[h.admin.SessionID]; !ok {
		t.Fatal("current session revoked")
	}
}

func TestOperatorEnrollAndReset(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()
	s1 := uuid.New()
	h.store.sessions[s1] = false
	en, codes, err := h.sf.Enroll(ctx, h.admin.UserID, false)
	if err != nil || len(codes) != recoveryCodeCount || en.URI == "" {
		t.Fatalf("enroll: %v %d", err, len(codes))
	}
	if len(h.store.sessions) != 0 {
		t.Fatal("sessions survive an operator enroll")
	}
	if _, _, err := h.sf.Enroll(ctx, h.admin.UserID, false); !errors.Is(err, ErrTwoFactorAlreadyEnabled) {
		t.Fatalf("second enroll without --force: %v", err)
	}
	if _, _, err := h.sf.Enroll(ctx, h.admin.UserID, true); err != nil {
		t.Fatalf("--force: %v", err)
	}
	h.secret, _ = totp.Decode(en.Secret)
	if err := h.sf.Verify(ctx, h.admin.UserID, h.code(), ""); !errors.Is(err, ErrTwoFactorCodeInvalid) {
		t.Fatalf("old secret must stop working after --force: %v", err)
	}
	if err := h.sf.Reset(ctx, h.admin.UserID); err != nil || h.store.totp != nil {
		t.Fatalf("reset: %v", err)
	}
	h.store.user.Role = gen.UserRoleSeeker
	if _, _, err := h.sf.Enroll(ctx, h.admin.UserID, false); !errors.Is(err, ErrTwoFactorAdminsOnly) {
		t.Fatalf("non-admin: %v", err)
	}
}

// ---- Redis-backed stores (skipped without a Redis) ----------------------------------------

func testRedis(t *testing.T) *redis.Client {
	t.Helper()
	url := os.Getenv("TEST_REDIS_URL")
	if url == "" {
		url = "redis://localhost:6390/15"
	}
	opt, err := redis.ParseURL(url)
	if err != nil {
		t.Skip(err)
	}
	rdb := redis.NewClient(opt)
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		t.Skip("no redis:", err)
	}
	t.Cleanup(func() { rdb.Close() })
	return rdb
}

func TestChallengeStoreAttemptCapAndNoResurrection(t *testing.T) {
	rdb := testRedis(t)
	ctx := context.Background()
	c := &ChallengeStore{RDB: rdb}
	uid := uuid.New()
	ch, err := c.Create(ctx, uid, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	for i := 1; i <= challengeAttempts; i++ {
		got, err := c.Attempt(ctx, ch.Token)
		if err != nil || got != uid {
			t.Fatalf("attempt %d: %v %v", i, got, err)
		}
	}
	if _, err := c.Attempt(ctx, ch.Token); !errors.Is(err, ErrTwoFactorChallenge) {
		t.Fatalf("attempt over the cap: %v", err)
	}
	if n, _ := rdb.Exists(ctx, challengeKey(ch.Token)).Result(); n != 0 {
		t.Fatal("worn-out challenge still stored")
	}
	if _, err := c.Attempt(ctx, "unknown"); !errors.Is(err, ErrTwoFactorChallenge) {
		t.Fatalf("unknown: %v", err)
	}
	if n, _ := rdb.Exists(ctx, challengeKey("unknown")).Result(); n != 0 {
		t.Fatal("attempt on a missing challenge created a key")
	}
	ch, _ = c.Create(ctx, uid, time.Now())
	if !c.Consume(ctx, ch.Token) || c.Consume(ctx, ch.Token) {
		t.Fatal("consume must succeed once")
	}
}

func TestFailureBudgetRedis(t *testing.T) {
	rdb := testRedis(t)
	ctx := context.Background()
	b := &FailureBudget{RDB: rdb}
	uid := uuid.New()
	t.Cleanup(func() { rdb.Del(ctx, failureKey(uid)) })
	for i := 0; i < maxCodeFailures; i++ {
		if err := b.Reserve(ctx, uid); err != nil {
			t.Fatalf("reserve %d: %v", i, err)
		}
	}
	if err := b.Reserve(ctx, uid); !isTooMany(err) {
		t.Fatalf("over the budget: %v", err)
	}
	if ttl := rdb.TTL(ctx, failureKey(uid)).Val(); ttl <= 0 || ttl > failureWindow {
		t.Fatalf("window not set: %v", ttl)
	}
	b.Release(ctx, uid)
	if err := b.Reserve(ctx, uid); err != nil {
		t.Fatalf("after a release: %v", err)
	}
	other := uuid.New()
	b.Release(ctx, other) // never creates a key
	if n, _ := rdb.Exists(ctx, failureKey(other)).Result(); n != 0 {
		t.Fatal("release created a key")
	}
}
