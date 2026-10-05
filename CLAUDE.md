# Guitar Prompter

Guitar workspace for transcribing and performing songs: a visual tab + chord editor first, a stage teleprompter later. Rebuilt from scratch in Oct 2026. The old Vue app is kept only as the `v0-vue` git tag. Don't copy anything from it.

## Conventions (non-negotiable)
- **Plan first.** Post a written plan on the GitHub issue and get Cameron's OK before writing code.
- **Every feature and bug is a GitHub issue.** One branch per issue: `feat/â€¦`, `fix/â€¦`, `chore/â€¦`.
- **PRs auto-close their issue.** The PR body includes `Closes #N`.
- `#29` is the pinned tracking issue. There's no Projects board (Cameron doesn't want one).

## Stack
React 19 + TypeScript + Vite, Zustand, VexFlow 4 (notation + tab), Web Audio (Karplusâ€“Strong synth), Vitest. Static site. Songs persist to localStorage plus a pluggable `RemoteStore` (`src/storage/storage.ts`). The remote is Supabase, called straight from the browser with RLS on the `songs` table (`supabase/migrations`). There's no server. Sync is newest-wins with tombstones (`src/storage/sync.ts`, unit tested). Keys go in `.env.local` (see `.env.example`). Single user, no multi-user plans.

## Commands
```bash
start.cmd              # double-click: installs deps if needed, runs at http://localhost:5179
npm run dev            # Vite dev server
npm test               # unit tests (chord engine, voicings, chord naming)
npm run typecheck
npm run build:single && node scripts/artifact.mjs   # â†’ dist-single/guitar-prompter.html for the claude.ai artifact
```
Cameron runs it **locally** (start.cmd). A claude.ai artifact build also exists at https://claude.ai/artifact/ViFadHwtotywdnhEJ5xRjE, but it isn't the main way he uses the app.

## Model (src/model)
- Song â†’ parts â†’ bars â†’ beats. **All parts have the same bar count** (registered), so a chord part and a tab part line up bar for bar.
- Part `kind`: `tab` (notation + tab) or `chords` (slash chart with chord names).
- Note `string` 0 is the highest string, and frets are **capo-relative**. Chord names are stored as the **shape** you play. The "No capo" view translates names (`transposeChord`) and frets (+capo) for display only.
- Voicings come from search (`voicing.ts`), never from a lookup table. `identifyChord` names any set of notes.
- Durations are in ticks: whole = 64, quarter = 16.

## Design
"Rosewood & Pearl", sleek and compact, in a single dark world. Tokens live at the top of `src/styles.css`. `PRODUCT.md` holds product context.
