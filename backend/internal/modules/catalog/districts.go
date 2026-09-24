package catalog

import (
	"bytes"
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"

	"jobvacancy.uz/backend/db/gen"
)

// District is one row of the SOATO district file (db/data/districts.csv).
type District struct {
	Soato      int32
	RegionSlug string
	Kind       string // district | city
	Slug       string
	Names      Names
	SortOrder  int32
}

// ParseDistricts reads the district file: '#' comment lines, a header, then one row per
// district or city of regional subordination.
func ParseDistricts(data []byte) ([]District, error) {
	var lines []byte
	for _, l := range bytes.SplitAfter(data, []byte("\n")) {
		if !bytes.HasPrefix(bytes.TrimSpace(l), []byte("#")) && len(bytes.TrimSpace(l)) > 0 {
			lines = append(lines, l...)
		}
	}
	r := csv.NewReader(bytes.NewReader(lines))
	r.FieldsPerRecord = 9
	header, err := r.Read()
	if err != nil {
		return nil, fmt.Errorf("districts: header: %w", err)
	}
	want := "soato,region,kind,slug,name_uz,name_uz_cyrl,name_ru,name_en,sort_order"
	if strings.Join(header, ",") != want {
		return nil, fmt.Errorf("districts: header is %q, want %q", strings.Join(header, ","), want)
	}
	var out []District
	seen := map[string]bool{}
	for {
		rec, err := r.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("districts: %w", err)
		}
		soato, err1 := strconv.ParseInt(rec[0], 10, 32)
		sort, err2 := strconv.ParseInt(rec[8], 10, 32)
		d := District{Soato: int32(soato), RegionSlug: rec[1], Kind: rec[2], Slug: rec[3],
			Names: Names{Uz: rec[4], UzCyrl: rec[5], Ru: rec[6], En: rec[7]}, SortOrder: int32(sort)}
		switch {
		case err1 != nil || soato < 1700000 || soato > 1799999:
			return nil, fmt.Errorf("districts: bad soato %q", rec[0])
		case err2 != nil:
			return nil, fmt.Errorf("districts: bad sort_order %q", rec[8])
		case d.Kind != string(gen.RegionKindDistrict) && d.Kind != string(gen.RegionKindCity):
			return nil, fmt.Errorf("districts: %s: bad kind %q", d.Slug, d.Kind)
		case d.Slug == "" || d.RegionSlug == "" || d.Names.Uz == "" || d.Names.UzCyrl == "" || d.Names.Ru == "" || d.Names.En == "":
			return nil, fmt.Errorf("districts: row %d has an empty field", soato)
		case seen[d.Slug]:
			return nil, fmt.Errorf("districts: duplicate slug %s", d.Slug)
		}
		seen[d.Slug] = true
		out = append(out, d)
	}
	return out, nil
}

// ImportResult counts what an import changed.
type ImportResult struct {
	Total, Inserted, Updated, Unchanged int
}

// ImportDistricts upserts the districts in one statement; rows already equal are left
// alone, so running it again changes nothing. Every row's region must exist.
func ImportDistricts(ctx context.Context, q *gen.Queries, ds []District) (ImportResult, error) {
	p := gen.UpsertDistrictsParams{}
	for _, d := range ds {
		p.RegionSlugs = append(p.RegionSlugs, d.RegionSlug)
		p.Kinds = append(p.Kinds, d.Kind)
		p.Slugs = append(p.Slugs, d.Slug)
		p.NamesUz = append(p.NamesUz, d.Names.Uz)
		p.NamesUzCyrl = append(p.NamesUzCyrl, d.Names.UzCyrl)
		p.NamesRu = append(p.NamesRu, d.Names.Ru)
		p.NamesEn = append(p.NamesEn, d.Names.En)
		p.SortOrders = append(p.SortOrders, d.SortOrder)
		p.Soatos = append(p.Soatos, d.Soato)
	}
	regions, err := q.ListRegions(ctx)
	if err != nil {
		return ImportResult{}, err
	}
	top := map[string]bool{}
	for _, r := range regions {
		if r.ParentID == nil {
			top[r.Slug] = true
		}
	}
	for _, d := range ds {
		if !top[d.RegionSlug] {
			return ImportResult{}, fmt.Errorf("districts: %s: unknown region %q", d.Slug, d.RegionSlug)
		}
	}
	rows, err := q.UpsertDistricts(ctx, p)
	if err != nil {
		return ImportResult{}, err
	}
	res := ImportResult{Total: len(ds)}
	for _, r := range rows {
		if r.Inserted {
			res.Inserted++
		} else {
			res.Updated++
		}
	}
	res.Unchanged = res.Total - res.Inserted - res.Updated
	return res, nil
}
