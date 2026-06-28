#!/usr/bin/env python3
import os, re

ROOT = "/home/user/houston_apartment_locator"
SRC_DIRS = ["client/src", "server", "shared"]
EXTS = (".ts", ".tsx", ".js", ".jsx")
EXCLUDE = ("node_modules", "dist", "build", ".git", "coverage", ".next", "out")

files = []
for d in SRC_DIRS:
    for dp, dn, fn in os.walk(os.path.join(ROOT, d)):
        dn[:] = [x for x in dn if x not in EXCLUDE]
        for f in fn:
            if f.endswith(EXTS) and not f.endswith(".d.ts"):
                files.append(os.path.join(dp, f))

func_offenders = []   # (path, line, lines)
nest_offenders = []   # (path, line, depth)
file_offenders = []   # (path, totlines)

# function start patterns
func_pat = re.compile(
    r'(function\s+[A-Za-z_$][\w$]*\s*\(|'
    r'(?:export\s+)?(?:default\s+)?(?:async\s+)?function\b|'
    r'(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*(?::[^=]+)?=\s*(?:async\s*)?\([^)]*\)\s*(?::[^=]+)?=>|'
    r'[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{)'
)

for f in files:
    lines = open(f, encoding="utf-8", errors="ignore").read().splitlines()
    n = len(lines)
    rel = os.path.relpath(f, ROOT)
    if n > 400:
        file_offenders.append((rel, n))

    # brace-based function length: find lines that look like a function header ending with {
    i = 0
    while i < len(lines):
        ln = lines[i]
        if func_pat.search(ln) and ln.rstrip().endswith("{"):
            # walk braces
            depth = 0
            started = False
            j = i
            while j < len(lines):
                depth += lines[j].count("{") - lines[j].count("}")
                if lines[j].count("{") > 0:
                    started = True
                if started and depth <= 0:
                    break
                j += 1
            length = j - i + 1
            if length > 60:
                func_offenders.append((rel, i + 1, length))
            i = j + 1 if j > i else i + 1
        else:
            i += 1

    # max nesting depth via running brace counter, track deepest
    depth = 0
    maxdepth = 0
    maxline = 0
    for idx, ln in enumerate(lines):
        # ignore string-heavy noise minimally
        opens = ln.count("{")
        closes = ln.count("}")
        for _ in range(opens):
            depth += 1
            if depth > maxdepth:
                maxdepth = depth
                maxline = idx + 1
        depth -= closes
        if depth < 0:
            depth = 0
    if maxdepth > 6:  # raw brace depth ~ JSX/object inflate; report >6
        nest_offenders.append((rel, maxline, maxdepth))

func_offenders.sort(key=lambda x: -x[2])
file_offenders.sort(key=lambda x: -x[1])
nest_offenders.sort(key=lambda x: -x[2])

print("## LONG FUNCTIONS (>60 lines)")
for p, l, c in func_offenders[:20]:
    print(f"{p}:{l} — function ~{c} lines")
print("\n## LARGE FILES (>400 lines)")
for p, c in file_offenders[:20]:
    print(f"{p}:1 — file {c} lines")
print("\n## DEEP NESTING (raw brace depth >6)")
for p, l, d in nest_offenders[:20]:
    print(f"{p}:{l} — brace nesting depth {d}")
