#!/usr/bin/env python3
import os, re, subprocess, json

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

# Build a corpus of all file contents (for import/usage search)
contents = {f: open(f, encoding="utf-8", errors="ignore").read() for f in files}
allcode = "\n".join(contents.values())

export_re = re.compile(
    r'^export\s+(?:async\s+)?(?:default\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)',
    re.M)
named_re = re.compile(r'^export\s*\{([^}]*)\}', re.M)

unused = []
for f, c in contents.items():
    names = set()
    for m in export_re.finditer(c):
        names.add(m.group(1))
    for m in named_re.finditer(c):
        for part in m.group(1).split(","):
            n = part.strip().split(" as ")[-1].strip()
            if n and re.match(r'^[A-Za-z_$][\w$]*$', n):
                names.add(n)
    for n in names:
        if n in ("default",):
            continue
        # count usages outside the defining file
        cnt = 0
        for of, oc in contents.items():
            if of == f:
                continue
            if re.search(r'\b' + re.escape(n) + r'\b', oc):
                cnt += 1
                break
        if cnt == 0:
            unused.append((os.path.relpath(f, ROOT), n))

unused.sort()
for f, n in unused:
    print(f"{f} :: {n}")
print(f"\nTOTAL_UNUSED_EXPORTS={len(unused)}")
print(f"TOTAL_FILES={len(files)}")
