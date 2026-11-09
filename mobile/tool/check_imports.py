"""Architecture check for lib/:
- no import cycles;
- core/ imports only core/;
- a feature imports core/ and itself, never another feature;
- only app/ (and main.dart) import app/.

  python3 -I tool/check_imports.py      (exit 1 on a violation)
"""
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lib")
IMPORT = re.compile(r"^(?:import|export)\s+'([^']+)'", re.M)


def resolve(src, target):
    if target.startswith("package:jobvacancy/"):
        return os.path.normpath(os.path.join(ROOT, target[len("package:jobvacancy/"):]))
    if target.startswith(("package:", "dart:")):
        return None
    return os.path.normpath(os.path.join(os.path.dirname(src), target))


graph = {}
for d, _, files in os.walk(ROOT):
    for f in files:
        if not f.endswith(".dart") or f.endswith((".g.dart", ".freezed.dart")) or "/l10n/gen" in d:
            continue
        p = os.path.join(d, f)
        deps = [resolve(p, t) for t in IMPORT.findall(open(p, encoding="utf-8").read())]
        graph[p] = [x for x in deps if x and x.endswith(".dart") and "/l10n/gen" not in x]

rel = lambda p: os.path.relpath(p, ROOT)
def layer(path):
    parts = rel(path).split("/")
    return parts[0] if parts[0] != "features" else "features/" + parts[1]


def allowed(src, dst):
    a, b = layer(src), layer(dst)
    if a == b or b == "core":
        return True
    if b == "app":
        return a in ("app", "main.dart")
    if b.startswith("features/"):
        return a in ("app", "main.dart")  # features never import each other
    return False


bad = [(rel(a), rel(b)) for a, ds in graph.items() for b in ds if not allowed(a, b)]

cycles, color, stack = [], {}, []


def visit(n):
    color[n] = 1
    stack.append(n)
    for m in graph.get(n, []):
        if color.get(m) == 1:
            cycles.append([rel(x) for x in stack[stack.index(m):]] + [rel(m)])
        elif m in graph and not color.get(m):
            visit(m)
    stack.pop()
    color[n] = 2


for n in graph:
    if not color.get(n):
        visit(n)

for a, b in bad:
    print(f"layer violation: {a} -> {b}")
for c in cycles:
    print("cycle: " + " -> ".join(c))
print(f"{len(graph)} files, {len(bad)} layer violations, {len(cycles)} cycles")
sys.exit(1 if bad or cycles else 0)
