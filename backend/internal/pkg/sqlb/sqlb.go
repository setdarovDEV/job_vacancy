// Package sqlb builds WHERE clauses for dynamic listing queries with numbered placeholders.
//
// Listings are built dynamically (instead of "col = $1 OR $1 IS NULL" in one static
// statement) so the planner sees only the real conditions and can use partial indexes.
package sqlb

import (
	"fmt"
	"strings"
)

type Builder struct {
	Where []string
	Args  []any
}

// Arg appends a parameter and returns its placeholder ("$3").
func (b *Builder) Arg(v any) string {
	b.Args = append(b.Args, v)
	return fmt.Sprintf("$%d", len(b.Args))
}

// Add appends a condition, replacing each "?" with the next argument's placeholder.
func (b *Builder) Add(cond string, args ...any) {
	for _, a := range args {
		cond = strings.Replace(cond, "?", b.Arg(a), 1)
	}
	b.Where = append(b.Where, cond)
}

// SQL joins the conditions with AND.
func (b *Builder) SQL() string { return strings.Join(b.Where, " AND ") }
