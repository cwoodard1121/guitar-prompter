# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend dev server (Vite HMR, uses dev middleware for API)
npm run dev

# Backend dev server (Express, serves built /dist + real API)
npm run dev:server

# Build frontend for production
npm run build

# Run production server locally (requires built /dist)
npm start
```

There is no test suite.

## Environment

Copy `.env.local.example` to `.env.local` and fill in:
- `OPENAI_API_KEY` — Whisper transcription, GPT chord/lyric search
- `SUPABASE_URL` / `SUPABASE_KEY` — database (songs, setlists, chord_cache tables)
- `SITE_PASSWORD` — optional cookie-based password gate
- `PORT` — defaults to 3000

## Architecture

**Stack:** Vue 3 SPA + Express 5 backend + Supabase (Postgres) + OpenAI

### Two dev environments

`npm run dev` runs Vite with a custom middleware plugin (`vite.config.js`) that intercepts `/api/*` requests and serves them from local JSON files (`songs.json`, `chord-cache.json`). This mirrors the production Express API exactly so the frontend code doesn't need to change between environments.

`npm run dev:server` / `npm start` runs `server.js` directly — Express serves `/dist` as a SPA and handles the same `/api/*` routes backed by Supabase.

### Key routes (server.js)

| Endpoint | Purpose |
|---|---|
| `GET/POST/PUT/DELETE /api/songs` | Song CRUD via Supabase |
| `GET/POST/PUT/DELETE /api/setlists` | Setlist CRUD |
| `GET /api/lyrics?title=&artist=` | AI web search for chord charts; cached in `chord_cache` table |
| `POST /api/chords` | Validates/reformats raw tab content using `o4-mini` |
| `POST /api/transcribe` | Whisper transcription of base64 audio chunks |
| `GET /api/parse-title` | Extracts artist/title from YouTube video titles |
| `GET /api/health` | Liveness check (App.vue polls this on startup) |

### State management

Two Pinia stores in `src/stores/`: `songs.js` and `setlists.js`. Both follow the same pattern: optimistic local state with `fetch`-based API calls, and graceful fallback to in-memory state on failure.

### Lyric sync engine (`src/composables/useLyricSync.js`)

Records mic audio in 5-second chunks via MediaRecorder, POSTs base64 audio to `/api/transcribe` (Whisper), then matches the transcript against parsed lyrics using a weighted algorithm: phonetic encoding + Longest Common Subsequence scoring, with proximity weighting toward the current scroll position. Auto-seeks when confidence exceeds `SEEK_THRESHOLD` (0.45), with cooldown to avoid thrashing. This feature is gated behind the **Experimental Features** toggle in Settings.

### Tab parsing (`src/utils/parseTab.js`)

Converts pasted Ultimate Guitar tabs (chord-over-lyric or inline `[Chord]` format) into a normalized two-line bracket notation used throughout the app.

### Chord diagrams

`src/data/chords.js` is a static database of 50+ chord shapes. `src/components/ChordDiagram.vue` renders them as SVG via the `svguitar` library, with capo transposition support.

### App startup

`App.vue` polls `/api/health` before rendering, with a visible spinner and retry logic. This handles Render's free-tier cold starts (~30s spinup time).

### Deployment

Deployed on Render (see `render.yaml`). Build: `npm install && npm run build`. Start: `node server.js`. Required env vars must be set in the Render dashboard.
