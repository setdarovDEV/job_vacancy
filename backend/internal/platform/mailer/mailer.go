// Package mailer sends transactional e-mail over SMTP.
// Callers never send directly from a request handler: they enqueue a jobs.SendEmail job.
package mailer

import (
	"context"
	"fmt"

	"github.com/wneessen/go-mail"

	"jobvacancy.uz/backend/internal/config"
)

type Message struct {
	To      string
	Subject string
	HTML    string
	Text    string
}

type Mailer interface {
	Send(ctx context.Context, m Message) error
}

type SMTP struct {
	client *mail.Client
	from   string
}

func NewSMTP(cfg config.SMTP) (*SMTP, error) {
	opts := []mail.Option{mail.WithPort(cfg.Port)}
	switch cfg.TLS {
	case "tls":
		opts = append(opts, mail.WithSSL())
	case "starttls":
		opts = append(opts, mail.WithTLSPolicy(mail.TLSMandatory))
	default:
		opts = append(opts, mail.WithTLSPolicy(mail.NoTLS))
	}
	if cfg.Username != "" {
		opts = append(opts,
			mail.WithSMTPAuth(mail.SMTPAuthPlain),
			mail.WithUsername(cfg.Username),
			mail.WithPassword(cfg.Password),
		)
	}
	c, err := mail.NewClient(cfg.Host, opts...)
	if err != nil {
		return nil, fmt.Errorf("mailer: %w", err)
	}
	return &SMTP{client: c, from: cfg.From}, nil
}

func (s *SMTP) Send(ctx context.Context, m Message) error {
	msg := mail.NewMsg()
	if err := msg.From(s.from); err != nil {
		return fmt.Errorf("mailer: from: %w", err)
	}
	if err := msg.To(m.To); err != nil {
		return fmt.Errorf("mailer: to: %w", err)
	}
	msg.Subject(m.Subject)
	msg.SetBodyString(mail.TypeTextPlain, m.Text)
	if m.HTML != "" {
		msg.AddAlternativeString(mail.TypeTextHTML, m.HTML)
	}
	if err := s.client.DialAndSendWithContext(ctx, msg); err != nil {
		return fmt.Errorf("mailer: send: %w", err)
	}
	return nil
}
