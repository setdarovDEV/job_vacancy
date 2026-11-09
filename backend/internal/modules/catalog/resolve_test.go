package catalog

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"jobvacancy.uz/backend/internal/pkg/apperr"
)

// API-032: a too-long name and too many names fail on different keys, in the request
// validator's shape, so clients can't read one limit as the other.
func TestResolveSkillsErrorShape(t *testing.T) {
	s := &Service{} // both checks run before any query
	long := strings.Repeat("x", MaxSkillNameLen+1)
	fields := func(err error) map[string]string {
		var ae *apperr.Error
		if !errors.As(err, &ae) {
			t.Fatalf("not an apperr: %v", err)
		}
		return ae.Fields
	}

	f := fields(func() error {
		_, err := s.ResolveSkills(context.Background(), []string{"Go", long}, MaxSkillsPerAd)
		return err
	}())
	if f["skills[1]"] != fmt.Sprintf("max=%d", MaxSkillNameLen) || f["skills"] != "" {
		t.Fatalf("long name: %v", f)
	}

	many := make([]string, MaxSkillsPerAd+1)
	for i := range many {
		many[i] = fmt.Sprintf("skill %d", i)
	}
	f = fields(func() error { _, err := s.ResolveSkills(context.Background(), many, MaxSkillsPerAd); return err }())
	if f["skills"] != fmt.Sprintf("max=%d", MaxSkillsPerAd) {
		t.Fatalf("too many: %v", f)
	}
}
