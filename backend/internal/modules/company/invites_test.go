package company

import (
	"context"
	"errors"
	"testing"
	"time"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/realtime"
	"jobvacancy.uz/backend/internal/testutil/fixture"
)

func newInviteEnv(t *testing.T) (*fixture.World, *Service, *fixture.Jobs) {
	t.Helper()
	w := fixture.New(t)
	_, rdb := fixture.Redis(t)
	cat := &catalog.Service{Q: w.Q, Log: w.Log}
	w.Must(cat.Reload(context.Background()))
	jobs := &fixture.Jobs{}
	notify := &notification.Service{Pool: w.Pool, Q: w.Q, Publisher: &realtime.Publisher{RDB: rdb}, Jobs: jobs, Log: w.Log}
	return w, &Service{Pool: w.Pool, Q: w.Q, Catalog: cat, Notify: notify}, jobs
}

// TZ FN-05 ✅ "Taklif qilingan odam qabul qilmaguncha kompaniya ma'lumotlarini ko'ra olmaydi":
// an invite doesn't make anyone a member; only accepting it does, and only the owner of
// the invited address (verified) can accept.
func TestInviteNeedsConsent(t *testing.T) {
	w, svc, jobs := newInviteEnv(t)
	ctx := context.Background()
	owner := w.User(gen.UserRoleEmployer, true)
	c := w.Company(owner.ID, true)
	invitee := w.User(gen.UserRoleEmployer, true)
	ip := fixture.Principal(invitee)

	inv, err := svc.Invite(ctx, fixture.Principal(owner), c.Slug, " "+*invitee.Email+" ", gen.CompanyMemberRoleRecruiter)
	if err != nil || inv.Role != "recruiter" || inv.ExpiresAt.Sub(time.Now()) < 6*24*time.Hour {
		t.Fatalf("invite: %+v %v", inv, err)
	}
	// Told in the app (stored notification); e-mail only goes out for verified addresses
	// with notifications on, which the fixture user has.
	if n := w.Int(`SELECT count(*) FROM notifications WHERE user_id = $1 AND type = 'company.invite'`, invitee.ID); n != 1 {
		t.Fatalf("%d invite notifications", n)
	}
	if !contains(jobs.Kinds(), "notification.deliver") {
		t.Fatalf("no delivery job: %v", jobs.Kinds())
	}

	// Not a member yet: nothing of the company is readable.
	if _, err := svc.Members(ctx, ip, c.Slug); !errors.Is(err, ErrForbidden) {
		t.Fatalf("members before accepting: %v", err)
	}
	if _, _, err := svc.Authorize(ctx, ip, c.ID.String(), gen.CompanyMemberRoleRecruiter); !errors.Is(err, ErrForbidden) {
		t.Fatalf("authorize before accepting: %v", err)
	}
	mine, _ := svc.Mine(ctx, invitee.ID)
	if len(mine) != 0 {
		t.Fatalf("my companies before accepting: %v", mine)
	}

	// Someone else can't answer it; the invitee sees it and accepts.
	stranger := fixture.Principal(w.User(gen.UserRoleEmployer, true))
	if _, err := svc.AcceptInvite(ctx, stranger, inv.ID); !errors.Is(err, ErrInviteNotFound) {
		t.Fatalf("stranger accepts: %v", err)
	}
	list, err := svc.MyInvites(ctx, invitee.ID)
	if err != nil || len(list) != 1 || list[0].Company.ID != c.ID {
		t.Fatalf("my invites: %+v %v", list, err)
	}
	d, err := svc.AcceptInvite(ctx, ip, inv.ID)
	if err != nil || d.MyRole != "recruiter" {
		t.Fatalf("accept: %+v %v", d, err)
	}
	if _, err := svc.Members(ctx, ip, c.Slug); err != nil {
		t.Fatalf("members after accepting: %v", err)
	}
	if n := w.Int(`SELECT count(*) FROM notifications WHERE user_id = $1 AND type = 'company.invite_accepted'`, owner.ID); n != 1 {
		t.Fatalf("inviter told %d times", n)
	}
	if _, err := svc.AcceptInvite(ctx, ip, inv.ID); !errors.Is(err, ErrInviteNotFound) {
		t.Fatalf("accepting twice: %v", err)
	}
	if _, err := svc.Invite(ctx, fixture.Principal(owner), c.Slug, *invitee.Email, gen.CompanyMemberRoleRecruiter); !errors.Is(err, ErrAlreadyMember) {
		t.Fatalf("inviting a member: %v", err)
	}
}

// Invites expire after 7 days, can be declined or revoked, need a verified address, and
// reach people without an account by e-mail.
func TestInviteLifecycle(t *testing.T) {
	w, svc, jobs := newInviteEnv(t)
	ctx := context.Background()
	owner := w.User(gen.UserRoleEmployer, true)
	op := fixture.Principal(owner)
	c := w.Company(owner.ID, false)

	// No account yet: an e-mail job to the address, nothing stored.
	addr := w.Email()
	inv, err := svc.Invite(ctx, op, c.Slug, addr, gen.CompanyMemberRoleAdmin)
	if err != nil {
		t.Fatal(err)
	}
	last := jobs.Args[len(jobs.Args)-1].(notification.DeliverArgs)
	if last.Email != addr || last.Channel != "email" || last.Type != "company.invite" || last.Payload.CompanyName != c.Name {
		t.Fatalf("e-mail job %+v", last)
	}
	// Re-inviting refreshes the pending invite instead of adding another.
	again, err := svc.Invite(ctx, op, c.Slug, addr, gen.CompanyMemberRoleRecruiter)
	if err != nil || again.ID != inv.ID || again.Role != "recruiter" {
		t.Fatalf("re-invite: %+v %v", again, err)
	}
	pending, _ := svc.Invites(ctx, op, c.Slug)
	if len(pending) != 1 {
		t.Fatalf("%d pending invites", len(pending))
	}

	// The address registers (unverified): it sees the invite but must verify to accept.
	var uid = w.User(gen.UserRoleEmployer, false).ID
	w.Exec(`UPDATE users SET email = $2 WHERE id = $1`, uid, addr)
	u, _ := w.Q.GetUserByID(ctx, uid)
	if _, err := svc.AcceptInvite(ctx, fixture.Principal(u), inv.ID); !errors.Is(err, ErrInviteEmailOnly) {
		t.Fatalf("unverified accept: %v", err)
	}
	// Expired invites can't be accepted.
	w.Exec(`UPDATE company_invites SET expires_at = now() - interval '1 minute' WHERE id = $1`, inv.ID)
	w.Exec(`UPDATE users SET email_verified_at = now() WHERE id = $1`, uid)
	if _, err := svc.AcceptInvite(ctx, fixture.Principal(u), inv.ID); !errors.Is(err, ErrInviteExpired) {
		t.Fatalf("expired accept: %v", err)
	}
	if list, _ := svc.MyInvites(ctx, uid); len(list) != 0 {
		t.Fatalf("expired invite still listed: %+v", list)
	}
	if list, _ := svc.Invites(ctx, op, c.Slug); len(list) != 1 || !list[0].Expired {
		t.Fatalf("company view of the expired invite: %+v", list)
	}
	// Resending opens a new 7-day window; declining closes it.
	inv, _ = svc.Invite(ctx, op, c.Slug, addr, gen.CompanyMemberRoleRecruiter)
	if err := svc.DeclineInvite(ctx, fixture.Principal(u), inv.ID); err != nil {
		t.Fatal(err)
	}
	if _, _, err := svc.Authorize(ctx, fixture.Principal(u), c.Slug, gen.CompanyMemberRoleRecruiter); !errors.Is(err, ErrForbidden) {
		t.Fatalf("declined invitee has access: %v", err)
	}
	// Revoking: only pending invites, only by company admins.
	inv, _ = svc.Invite(ctx, op, c.Slug, w.Email(), gen.CompanyMemberRoleRecruiter)
	if err := svc.RevokeInvite(ctx, fixture.Principal(u), c.Slug, inv.ID); !errors.Is(err, ErrForbidden) {
		t.Fatalf("outsider revokes: %v", err)
	}
	if err := svc.RevokeInvite(ctx, op, c.Slug, inv.ID); err != nil {
		t.Fatal(err)
	}
	if err := svc.RevokeInvite(ctx, op, c.Slug, inv.ID); !errors.Is(err, ErrInviteNotFound) {
		t.Fatalf("revoking twice: %v", err)
	}
	// Seekers can't be invited (an employer account is needed).
	seeker := w.User(gen.UserRoleSeeker, true)
	if _, err := svc.Invite(ctx, op, c.Slug, *seeker.Email, gen.CompanyMemberRoleRecruiter); !errors.Is(err, ErrMemberNotFound) {
		t.Fatalf("inviting a seeker: %v", err)
	}
}

func contains(ss []string, s string) bool {
	for _, x := range ss {
		if x == s {
			return true
		}
	}
	return false
}
