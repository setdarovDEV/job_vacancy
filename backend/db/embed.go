// Package db holds SQL migrations and sqlc queries. Migrations are embedded into the
// binary so a deployed release always carries exactly the schema it was built against.
package db

import "embed"

//go:embed migrations/*.sql
var Migrations embed.FS
