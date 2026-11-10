package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/app"
	"jobvacancy.uz/backend/internal/config"
	"jobvacancy.uz/backend/internal/platform/redis"
)

// twoFactor handles `ctl two-factor enroll <email> [--force]` and `ctl two-factor reset <email>`.
// Both sign the user out everywhere and write an audit line to stderr; the secret and the
// recovery codes go to stdout only, once.
func twoFactor(ctx context.Context, cfg *config.Config, pool *pgxpool.Pool, args []string) error {
	if len(args) < 2 || len(args) > 3 || (args[0] != "enroll" && args[0] != "reset") {
		return errors.New(usage)
	}
	force := false
	if len(args) == 3 {
		if args[0] != "enroll" || args[2] != "--force" {
			return errors.New(usage)
		}
		force = true
	}
	email := strings.ToLower(strings.TrimSpace(args[1]))
	u, err := gen.New(pool).GetUserByEmail(ctx, &email)
	if errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("no user with email %s", email)
	}
	if err != nil {
		return err
	}
	rdb, err := redis.New(ctx, cfg.Redis.URL)
	if err != nil {
		return err
	}
	defer rdb.Close()
	audit := slog.New(slog.NewJSONHandler(os.Stderr, nil))
	mfa, err := app.NewSecondFactor(cfg, pool, rdb, audit)
	if err != nil {
		return err
	}
	operator := os.Getenv("SUDO_USER")
	if operator == "" {
		operator = os.Getenv("USER")
	}

	if args[0] == "reset" {
		if err := mfa.Reset(ctx, u.ID); err != nil {
			return err
		}
		audit.Info("audit: two-factor reset", "user_id", u.ID, "email", email, "operator", operator)
		fmt.Printf("two-factor sign-in turned off for %s; all sessions signed out\n", email)
		return nil
	}

	en, codes, err := mfa.Enroll(ctx, u.ID, force)
	if err != nil {
		return err
	}
	audit.Info("audit: two-factor enrolled by operator", "user_id", u.ID, "email", email, "operator", operator, "replaced", force)
	fmt.Printf("Two-factor sign-in is on for %s (all sessions signed out).\n\n", email)
	fmt.Println("Add to an authenticator app: scan a QR code made from this URI")
	fmt.Println("(e.g. qrencode -t ANSIUTF8 '<uri>') or type the key.")
	fmt.Printf("\n  otpauth URI: %s\n  key:         %s\n\nRecovery codes (each works once):\n", en.URI, en.Secret)
	for _, c := range codes {
		fmt.Println("  " + c)
	}
	fmt.Println("\nThese are shown only now. Hand them over privately; don't store this output.")
	return nil
}
