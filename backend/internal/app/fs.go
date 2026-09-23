package app

import (
	"io/fs"

	"jobvacancy.uz/backend/db"
)

func migrationsFS() fs.FS {
	sub, err := fs.Sub(db.Migrations, "migrations")
	if err != nil {
		panic(err) // embedded path is fixed at compile time
	}
	return sub
}
