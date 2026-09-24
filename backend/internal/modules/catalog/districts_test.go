package catalog

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"jobvacancy.uz/backend/db"
	"jobvacancy.uz/backend/internal/testutil/fixture"
)

// The SOATO file is well formed: 206 units (175 districts, 31 cities of regional
// subordination) across the 14 regions, unique codes and slugs.
func TestDistrictFile(t *testing.T) {
	ds, err := ParseDistricts(db.Districts)
	if err != nil {
		t.Fatal(err)
	}
	perRegion := map[string]int{}
	kinds := map[string]int{}
	codes := map[int32]bool{}
	for _, d := range ds {
		perRegion[d.RegionSlug]++
		kinds[d.Kind]++
		if codes[d.Soato] {
			t.Fatalf("duplicate soato %d", d.Soato)
		}
		codes[d.Soato] = true
	}
	if len(ds) != 206 || kinds["district"] != 175 || kinds["city"] != 31 || len(perRegion) != 14 {
		t.Fatalf("%d rows, kinds %v, %d regions", len(ds), kinds, len(perRegion))
	}
	if perRegion["tashkent-city"] != 12 || perRegion["tashkent"] != 22 || perRegion["karakalpakstan"] != 17 {
		t.Fatalf("per region %v", perRegion)
	}
}

// TZ FN-06 ✅ "Filtrda viloyat tanlanganda tumanlar chiqadi": the import is idempotent and
// each region's districts are served by /catalog/regions/{region}/districts.
func TestImportDistrictsAndServe(t *testing.T) {
	w := fixture.New(t)
	ctx := context.Background()
	ds, err := ParseDistricts(db.Districts)
	w.Must(err)
	first, err := ImportDistricts(ctx, w.Q, ds)
	w.Must(err)
	if first.Total != 206 || first.Inserted+first.Updated+first.Unchanged != 206 {
		t.Fatalf("first import %+v", first)
	}
	again, err := ImportDistricts(ctx, w.Q, ds)
	w.Must(err)
	if again.Inserted != 0 || again.Updated != 0 || again.Unchanged != 206 {
		t.Fatalf("second import changed rows: %+v", again)
	}
	t.Logf("first import %+v, second %+v", first, again)

	svc := &Service{Q: w.Q, Log: w.Log}
	w.Must(svc.Reload(ctx))
	h := &Handler{Svc: svc}
	r := chi.NewRouter()
	r.Route("/catalog", h.Routes)
	get := func(path string) (int, []Region) {
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
		var body struct{ Data []Region }
		_ = json.Unmarshal(rec.Body.Bytes(), &body)
		return rec.Code, body.Data
	}
	code, sam := get("/catalog/regions/samarkand/districts")
	if code != 200 || len(sam) != 16 {
		t.Fatalf("samarkand districts: %d %d", code, len(sam))
	}
	if sam[0].Kind != "city" || sam[0].Name.Uz != "Samarqand shahri" || sam[0].Name.En != "Samarkand City" {
		t.Fatalf("first unit %+v (cities come first)", sam[0])
	}
	var id int32
	w.Must(w.Pool.QueryRow(ctx, `SELECT id FROM regions WHERE slug = 'samarkand'`).Scan(&id))
	if code, byID := get("/catalog/regions/" + itoa(id) + "/districts"); code != 200 || len(byID) != 16 {
		t.Fatalf("by id: %d %d", code, len(byID))
	}
	if code, _ := get("/catalog/regions/atlantis/districts"); code != 404 {
		t.Fatalf("unknown region: %d", code)
	}
	_, top := get("/catalog/regions?depth=1")
	_, full := get("/catalog/regions")
	total := 0
	for i := range full {
		total += len(full[i].Children)
		if len(top[i].Children) != 0 {
			t.Fatal("depth=1 has children")
		}
	}
	if len(top) != 14 || total < 206 {
		t.Fatalf("top %d, districts in the full tree %d", len(top), total)
	}
	// A district now validates against its region (vacancy and filter input).
	if err := svc.ValidateLocation(id, &sam[3].ID); err != nil {
		t.Fatalf("validate district: %v", err)
	}
}

func itoa(n int32) string {
	b, _ := json.Marshal(n)
	return string(b)
}
