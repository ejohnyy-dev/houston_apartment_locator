# FIXES — houston_apartment_locator

Prioritized cleanup plan derived from `.claude/audits/audit-report.md` (read-only recon).
**Nothing here is applied yet.** Execute one at a time.

> Cleanest of the TS repos: only 0.49% duplication. Small, focused cleanups.

## P1 — Safe deletes (high confidence, no importers)
1. **Delete `client/src/components/Map.tsx`** (`MapView` export — no importers anywhere). Risk: low.
2. **Delete `client/src/components/ManusDialog.tsx`** (`ManusDialog` — no importers). Risk: low.
3. **Remove dead app exports:**
   - `client/src/const.ts :: getLoginUrl`
   - `client/src/pages/seoContent.ts :: neighborhoodList`
   - `client/src/hooks/useComposition.ts :: UseCompositionOptions`, `UseCompositionReturn` (types)
   - Risk: low. Re-grep each before removing.

## P2 — Dedup (low risk)
4. **Extract repeated form-field blocks in `ContactForm.tsx`** (lines 226-234↔260-268 and 241-251↔275-285) into a reusable field component.
   - Risk: low-medium (live contact form). Characterization/render test first.
5. `ui/input.tsx` ↔ `ui/textarea.tsx` composition-handler clone (29-53) — vendored shadcn; **low priority / skip**.

## P3 — Complexity (test-first)
6. **Refactor `ContactForm.tsx`** (~310-line component, internal dup, depth 7) — combine with P2 #4. Test-first.
7. `server/index.ts` (155-line handler, depth 8) — review for extraction. Medium risk.
   - Page components (`NeighborhoodPage`, `Navbar`, `Footer`) are lower priority.

## Caveats
- knip dep/file lists are **unreliable** — it couldn't load `vite.config.ts` (missing `@builder.io/vite-plugin-jsx-loc`). For a real dependency audit, add a `knip.json` or fix the config, then re-run after `pnpm install`.
- `client/src/components/ui/*` (~253 "unused" exports) are vendored shadcn primitives — **not** dead code; do not strip.
