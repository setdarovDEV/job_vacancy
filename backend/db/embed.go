// Package db holds SQL migrations and sqlc queries. Migrations are embedded into the
// binary so a deployed release always carries exactly the schema it was built against.
package db

import "embed"

//go:embed migrations/*.sql
var Migrations embed.FS

// Districts is the SOATO district list loaded by `ctl import-districts` (TZ FN-06); see
// the header of data/districts.csv for its source.
//
//go:embed data/districts.csv
var Districts []byte
