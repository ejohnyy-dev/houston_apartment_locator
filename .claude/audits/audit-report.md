# Audit Report — houston_apartment_locator
_Generated 2026-06-28. Read-only reconnaissance. Tools: jscpd, knip, custom complexity heuristic._

## Summary
- Lines of source scanned: 8,412 (client/src, server, shared; excludes node_modules/dist/build/*.d.ts)
- Duplication: 0.49% (3 clones)
- Dead code: 2 unused application files, ~6 genuinely unused application exports, 0 confidently-unused deps (knip dep results unreliable — see caveats)
- Complexity hotspots: 14 functions >60 lines, 1 file >400 lines, 4 deep-nesting sites
- Top 3 highest-impact cleanups:
  1. Delete unused files `client/src/components/Map.tsx` and `client/src/components/ManusDialog.tsx` (no importers anywhere).
  2. Refactor `client/src/components/ContactForm.tsx` — a single ~310-line component containing the two duplicated form-field blocks; extract a reusable field/control.
  3. Remove dead app exports: `getLoginUrl` (`client/src/const.ts`), `neighborhoodList` (`client/src/pages/seoContent.ts`), and the `UseComposition*` types.

## Duplication (jscpd)
Total: 0.49% duplicated lines (42 of 8,527 measured lines), 3 exact clones across 78 files.

| Tokens | File A | Lines A | File B | Lines B |
|-------:|--------|--------:|--------|--------:|
| 78 | client/src/components/ui/input.tsx | 29–53 | client/src/components/ui/textarea.tsx | 29–53 |
| 54 | client/src/components/ContactForm.tsx | 226–234 | client/src/components/ContactForm.tsx | 260–268 |
| 52 | client/src/components/ContactForm.tsx | 241–251 | client/src/components/ContactForm.tsx | 275–285 |

Notes: The input/textarea clone is the composition-handler boilerplate shared by both controls (extractable into the existing `useComposition` hook usage). The two ContactForm clones are repeated form-field blocks within the same file (good extract-component candidate).

## Dead Code (knip)
**knip could not run reliably.** It failed to load `vite.config.ts` (`Cannot find module '@builder.io/vite-plugin-jsx-loc'`), so it never resolved the real entry points (`client/src/main.tsx`, `server/index.ts`) and consequently reported **all 82 files, 50 deps, and 14 devDeps as "unused."** Those blanket lists are false positives and are NOT reproduced here. Findings below come from a ripgrep-based fallback (cross-file symbol-usage search). Confidence is noted per item.

### Unused files
- `client/src/components/Map.tsx` — **high confidence**; `MapView` export and the file have no importers in client/src, server, or shared.
- `client/src/components/ManusDialog.tsx` — **high confidence**; `ManusDialog` export has no importers anywhere in source.
- (low confidence) `client/public/__manus__/debug-collector.js` — referenced by no source/HTML; appears to be a vendor/runtime injection artifact, may be loaded externally.

### Unused exports / types
High confidence (application code, no cross-file references):
- `client/src/const.ts :: getLoginUrl`
- `client/src/pages/seoContent.ts :: neighborhoodList`
- `client/src/hooks/useComposition.ts :: UseCompositionOptions` (type)
- `client/src/hooks/useComposition.ts :: UseCompositionReturn` (type)
- `client/src/components/Map.tsx :: MapView` (whole file unused)
- `client/src/components/ManusDialog.tsx :: ManusDialog` (whole file unused)

Low confidence / expected:
- ~253 additional unused exports are in `client/src/components/ui/*` (vendored shadcn/ui primitives). These are intentionally-complete library files; many exports are unused by this app but should NOT be treated as dead code. Examples: full `sidebar.tsx`, `menubar.tsx`, `context-menu.tsx`, `chart.tsx`, `carousel.tsx`, `command.tsx` exports — none imported by app pages/components.

### Unused dependencies
Not reported with confidence. knip's 50 "unused dependencies" + 14 "unused devDependencies" lists are a side-effect of the failed entry-point resolution (it lists react, react-dom, vite, etc. — clearly used). A reliable dependency audit requires fixing the vite config load or providing a `knip.json`. Flag for manual follow-up: the many unused `@radix-ui/*` packages likely correspond 1:1 to the unused `ui/*` primitives above, but this cannot be confirmed from the broken run.

## Complexity
Worst offenders (path:line — metric):

Long functions (>60 lines):
- client/src/components/ContactForm.tsx:36 — function ~310 lines
- client/src/components/ui/calendar.tsx:12 — function ~160 lines
- server/index.ts:9 — function ~155 lines
- client/src/components/Footer.tsx:6 — function ~129 lines
- client/src/components/ui/sidebar.tsx:153 — function ~109 lines
- client/src/pages/NeighborhoodPage.tsx:11 — function ~109 lines
- client/src/components/Navbar.tsx:16 — function ~107 lines
- client/src/components/ui/sidebar.tsx:55 — function ~97 lines
- client/src/components/ui/carousel.tsx:43 — function ~89 lines
- client/src/pages/MoveInSpecials.tsx:33 — function ~84 lines
- client/src/pages/FAQ.tsx:40 — function ~83 lines
- client/src/components/HoustonSection.tsx:28 — function ~65 lines
- client/src/components/ManusDialog.tsx:21 — function ~65 lines
- client/src/components/ui/input.tsx:6 — function ~63 lines

Large files (>400 lines):
- client/src/components/ui/sidebar.tsx:1 — file 734 lines (vendored ui primitive)

Deep nesting (raw brace depth >6; JSX/object literals inflate this metric):
- client/src/components/ui/chart.tsx:91 — depth 8
- server/index.ts:105 — depth 8
- client/src/components/ContactForm.tsx:76 — depth 7
- client/src/components/ui/calendar.tsx:139 — depth 7

App-owned hotspots worth attention: `ContactForm.tsx` (310-line component + internal duplication + depth 7), `server/index.ts` (155-line handler, depth 8), and the page components (`NeighborhoodPage`, `Navbar`, `Footer`, `MoveInSpecials`, `FAQ`). The `ui/*` entries (calendar, sidebar, carousel, chart) are vendored shadcn primitives — low priority.

## Caveats
- **knip did not produce usable results.** Its entry-point resolution failed because `vite.config.ts` imports `@builder.io/vite-plugin-jsx-loc`, which is not installed (no `node_modules`; per the read-only spec, no install was performed). All knip file/dependency "unused" lists are therefore false positives and were excluded; dead-code findings above use a ripgrep fallback instead.
- The ripgrep fallback matches bare identifiers across files; it can miss dynamic/string-based usage and cannot distinguish re-exports. Items are confidence-labeled accordingly.
- The complexity heuristic is brace-based. For JSX/TSX, raw brace depth and function-length counts are inflated by markup and object literals, so the "deep nesting" numbers are relative indicators, not true control-flow nesting.
- `client/src/components/ui/*` are vendored shadcn/ui components; their unused exports and size are expected and were down-weighted throughout.
- Scope excluded per spec: node_modules, dist, build, .git, coverage, *.min.js, *.d.ts, .next, out.
