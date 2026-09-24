// Command ctl is the operator CLI for tasks that have no API on purpose.
//
//	ctl set-role <email> <seeker|employer|admin>
//	ctl reindex-search
//	ctl run-alerts
//	ctl telegram-webhook <https://jobvacancy.uz/api/v1/telegram/webhook>
//	ctl import-districts [file.csv]   (default: the embedded SOATO list, db/data/districts.csv)
//	ctl vacancy-lifecycle             (one run of expiry, expiry warnings and "TOP" end; the worker does it periodically)
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"jobvacancy.uz/backend/db"
	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/app"
	"jobvacancy.uz/backend/internal/config"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/modules/vacancy"
	"jobvacancy.uz/backend/internal/platform/postgres"
	"jobvacancy.uz/backend/internal/platform/redis"
	"jobvacancy.uz/backend/internal/platform/telegram"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

const usage = `usage:
  ctl set-role <email> <seeker|employer|admin>
  ctl reindex-search
  ctl run-alerts
  ctl telegram-webhook <url>
  ctl import-districts [file.csv]
  ctl vacancy-lifecycle`

func run(args []string) error {
	if len(args) == 0 {
		return errors.New(usage)
	}
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx := context.Background()
	pool, err := postgres.NewPool(ctx, cfg.DB)
	if err != nil {
		return err
	}
	defer pool.Close()

	switch {
	case args[0] == "set-role" && len(args) == 3:
		return setRole(ctx, pool, args[1], args[2])
	case args[0] == "reindex-search" && len(args) == 1:
		return reindex(ctx, pool)
	case args[0] == "run-alerts" && len(args) == 1:
		rdb, err := redis.New(ctx, cfg.Redis.URL)
		if err != nil {
			return err
		}
		defer rdb.Close()
		svc, err := app.SavedSearches(ctx, pool, rdb, slog.Default())
		if err != nil {
			return err
		}
		checked, alerted, err := svc.RunAlerts(ctx)
		fmt.Printf("checked %d saved searches, alerted %d\n", checked, alerted)
		return err
	case args[0] == "vacancy-lifecycle" && len(args) == 1:
		rdb, err := redis.New(ctx, cfg.Redis.URL)
		if err != nil {
			return err
		}
		defer rdb.Close()
		l, err := app.VacancyLifecycle(pool, rdb, slog.Default())
		if err != nil {
			return err
		}
		expired, err := l.Expire(ctx)
		if err != nil {
			return err
		}
		warned, err := l.WarnExpiring(ctx)
		if err != nil {
			return err
		}
		ended, err := l.EndFeatured(ctx)
		fmt.Printf("expired %d, warned about %d, TOP ended for %d vacancies\n", expired, warned, ended)
		return err
	case args[0] == "import-districts" && len(args) <= 2:
		return importDistricts(ctx, pool, args[1:])
	case args[0] == "telegram-webhook" && len(args) == 2:
		if cfg.Telegram.BotToken == "" {
			return errors.New("TELEGRAM_BOT_TOKEN is not set")
		}
		bot := telegram.NewBot(cfg.Telegram.BotToken, cfg.Telegram.BotUsername)
		if err := bot.SetWebhook(ctx, args[1], cfg.Telegram.WebhookSecret); err != nil {
			return err
		}
		fmt.Println("webhook set to", args[1])
		return nil
	}
	return errors.New(usage)
}

// importDistricts loads the SOATO districts (TZ FN-06). Idempotent: a second run reports
// every row unchanged. The API picks the new catalog up within 5 minutes (or on restart).
func importDistricts(ctx context.Context, pool *pgxpool.Pool, args []string) error {
	data := db.Districts
	src := "embedded db/data/districts.csv"
	if len(args) == 1 {
		b, err := os.ReadFile(args[0])
		if err != nil {
			return err
		}
		data, src = b, args[0]
	}
	ds, err := catalog.ParseDistricts(data)
	if err != nil {
		return err
	}
	res, err := catalog.ImportDistricts(ctx, gen.New(pool), ds)
	if err != nil {
		return err
	}
	fmt.Printf("districts from %s: %d rows, %d inserted, %d updated, %d unchanged\n",
		src, res.Total, res.Inserted, res.Updated, res.Unchanged)
	if res.Updated > 0 {
		fmt.Println("existing names changed: run `ctl reindex-search` so search matches the new names")
	}
	return nil
}

func reindex(ctx context.Context, pool *pgxpool.Pool) error {
	q := gen.New(pool)
	log := slog.Default()
	cat := &catalog.Service{Q: q, Log: log}
	if err := cat.Reload(ctx); err != nil {
		return err
	}
	svc := &vacancy.Service{Pool: pool, Q: q, Catalog: cat, Log: log}
	n, err := svc.Reindex(ctx)
	fmt.Printf("reindexed %d vacancies\n", n)
	return err
}

func setRole(ctx context.Context, pool *pgxpool.Pool, emailArg, roleArg string) error {
	role := gen.UserRole(roleArg)
	if !role.Valid() {
		return fmt.Errorf("unknown role %q", roleArg)
	}

	email := strings.ToLower(strings.TrimSpace(emailArg))
	u, err := gen.New(pool).SetUserRole(ctx, gen.SetUserRoleParams{Email: &email, Role: role})
	if errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("no user with email %s", email)
	}
	if err != nil {
		return err
	}
	fmt.Printf("%s (%s) is now %s; takes effect on the next token refresh\n", u.FullName, email, u.Role)
	return nil
}
