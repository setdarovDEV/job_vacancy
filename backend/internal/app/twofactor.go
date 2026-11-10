package app

import (
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
	goredis "github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/config"
	"jobvacancy.uz/backend/internal/modules/auth"
	"jobvacancy.uz/backend/internal/pkg/sealbox"
)

// NewSecondFactor builds two-factor sign-in for the API and for `ctl two-factor`.
// Production requires its own TOTP_ENC_KEY (config refuses to start otherwise); elsewhere
// a key derived from JWT_SECRET is used, with a warning.
func NewSecondFactor(cfg *config.Config, pool *pgxpool.Pool, rdb *goredis.Client, log *slog.Logger) (*auth.SecondFactor, error) {
	key := cfg.Auth.TOTPEncKey
	if key == "" {
		log.Warn("TOTP_ENC_KEY not set: 2FA secrets are sealed with a key derived from JWT_SECRET (development only)")
		key = cfg.Auth.JWTSecret
	}
	box, err := sealbox.New([]byte(key), "totp")
	if err != nil {
		return nil, err
	}
	return &auth.SecondFactor{
		Store:         auth.PGTwoFactorStore{Queries: gen.New(pool), Pool: pool},
		Box:           box,
		Challenges:    &auth.ChallengeStore{RDB: rdb},
		Failures:      &auth.FailureBudget{RDB: rdb},
		Sessions:      auth.NewRevocationStore(rdb, cfg.Auth.AccessTokenTTL),
		Issuer:        cfg.AppName,
		AdminRequired: cfg.Auth.Admin2FARequired,
		Log:           log,
	}, nil
}
