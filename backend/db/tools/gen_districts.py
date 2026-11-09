"""Builds the districts seed migration from MIMAXUZ/uzbekistan-regions-data (SOATO codes).
Usage: python3 -I gen_districts.py <regions.json> <districts.json> > 00012_seed_districts.sql"""
import json, re, sys

L = lambda f: json.load(open(f, encoding="utf-8-sig"))
regions = {r["id"]: r for r in L(sys.argv[1])}
districts = L(sys.argv[2])

# Our region slugs keyed by SOATO region code.
SLUG = {1703: "andijan", 1706: "bukhara", 1708: "jizzakh", 1710: "kashkadarya", 1712: "navoi",
        1714: "namangan", 1718: "samarkand", 1722: "surkhandarya", 1724: "syrdarya",
        1726: "tashkent-city", 1727: "tashkent", 1730: "fergana", 1733: "khorezm", 1735: "karakalpakstan"}
SKIP_REGIONS = {1726}  # Tashkent city districts are already seeded in 00003

LAT2CYR = str.maketrans({"p": "р", "a": "а", "e": "е", "o": "о", "c": "с", "x": "х", "y": "у",
                         "P": "Р", "A": "А", "E": "Е", "O": "О", "C": "С", "X": "Х", "H": "Н", "K": "К", "M": "М", "T": "Т", "B": "В"})

def cyr(s):  # Latin look-alikes inside Cyrillic words (e.g. "Заpафшан") break search
    return re.sub(r"\w+", lambda m: m.group(0).translate(LAT2CYR) if re.search("[а-яёўқғҳА-ЯЁЎҚҒҲ]", m.group(0)) else m.group(0), s)

def lat(s):
    return re.sub(r"[‘’ʻʼ`´]", "'", s).replace("Sh.Rashidov", "Sharof Rashidov").replace(" shaxar", "").strip()

def ascii_name(s):  # for slugs and English
    return re.sub(r"(?<=[OoGg])'", "", s).replace("'", "")

def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", ascii_name(s).lower()).strip("-")

def q(s):
    return "'" + s.replace("'", "''") + "'"

rows, seen = [], set()
for d in districts:
    reg = regions[d["region_id"]]
    rcode = reg["soato_id"]
    if rcode in SKIP_REGIONS or not d.get("name_ru"):
        continue
    uz = lat(d["name_uz"]); cy = cyr(re.sub(r"[‘’]", "'", d["name_oz"])).strip(); ru = cyr(d["name_ru"]).strip()
    cy = cy.replace("Ш.Рашидов", "Шароф Рашидов").replace(" шахар", "")
    ru = ru.replace("Ш.Рашидовский", "Шараф-Рашидовский")
    # SOATO 4xx codes are cities; the source mislabels G'ozg'on as a district.
    if str(d["soato_id"])[4] == "4" and len(str(d["soato_id"])) == 7 and uz.endswith(" tumani"):
        uz, cy, ru = uz[: -len(" tumani")], cy.replace(" тумани", ""), ru.replace("ский район", "").replace("Газган", "Газган")
    is_district = uz.endswith(" tumani")
    base = uz[: -len(" tumani")] if is_district else uz
    if is_district:
        en = f"{ascii_name(base)} District"
        slug = f"{SLUG[rcode]}-{slugify(base)}"
    else:
        uz = f"{base} shahri"
        cy = cy if cy.endswith("шаҳри") else f"{cy.replace('город ', '')} шаҳри"
        ru = ru if ru.startswith("г") and ru.startswith("г.") else f"г. {ru.replace('город ', '')}"
        en = f"{ascii_name(base)} City"
        slug = f"{SLUG[rcode]}-{slugify(base)}-city"
    assert slug not in seen, slug
    seen.add(slug)
    rows.append((SLUG[rcode], "district" if is_district else "city", slug, uz, cy, ru, en, d["soato_id"], is_district))

# Cities first, then districts, each alphabetical (Uzbek Latin).
out = []
for parent in sorted({r[0] for r in rows}):
    group = sorted([r for r in rows if r[0] == parent], key=lambda r: (r[8], r[3].replace("'", "")))
    for i, r in enumerate(group):
        out.append((*r[:7], (i + 1) * 10, r[7]))

print("""-- +goose Up
-- Districts and district-level cities of every region except Tashkent city (seeded in 00003).
-- Source: SOATO-coded list from github.com/MIMAXUZ/uzbekistan-regions-data (April 2025),
-- cleaned up: Latin look-alike letters inside Cyrillic words fixed, apostrophes unified,
-- English names added. soato in the trailing comment is the classifier code.
INSERT INTO regions (parent_id, kind, slug, name_uz, name_uz_cyrl, name_ru, name_en, sort_order)
SELECT p.id, v.kind::region_kind, v.slug, v.uz, v.cyrl, v.ru, v.en, v.sort
FROM (VALUES""")
lines = [f"  ({q(r[0])}, {q(r[1])}, {q(r[2])}, {q(r[3])}, {q(r[4])}, {q(r[5])}, {q(r[6])}, {r[7]})" for r in out]
for i, (l, r) in enumerate(zip(lines, out)):
    print(l + ("," if i < len(lines) - 1 else "") + f" -- {r[8]}")
print(""") AS v(parent, kind, slug, uz, cyrl, ru, en, sort)
JOIN regions p ON p.slug = v.parent;

-- +goose Down
DELETE FROM regions
WHERE parent_id IN (SELECT id FROM regions WHERE parent_id IS NULL AND slug <> 'tashkent-city');""")
print(f"rows={len(out)}", file=sys.stderr)
