# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 19 + TypeScript + Vite, Zustand for state. VexFlow renders standard notation and tablature. Web Audio for playback. Static site. localStorage caching plus Supabase (RLS, no server of our own) for sync, recordings, setlists and share links. Chosen by Cameron on 2026-10-05; the previous Vue app is discarded entirely — no code, routes or structure carried over.

## Users

Cameron (and guitarists like him): a gigging / rehearsing guitarist who needs to get songs out of his head and ears and onto the page quickly — tabbing riffs and charting chords — on a laptop, with mouse or touch as the main input.

## Product Purpose

A guitar workspace for transcribing and performing songs. First and most important: **transcription** — tab out parts and tap in chords quickly, with multiple parts per song (rhythm, lead, bass…), capo support, and exports. Later: a stage teleprompter, setlists, synced lyrics, sharing.

Success: tabbing a riff or charting a song feels faster and easier than Guitar Pro or Songsterr's editor, and the result exports cleanly.

## Positioning

Songsterr-grade visual tab (notation + tab, clicky, readable) combined with a fast chord-tapping workflow and capo-aware charts, in one tool built for a working player rather than a notation engraver.

## Operating Context

- Laptop at home or at rehearsal, guitar in hand — input happens between playing, so actions must be one click/tap and forgiving (undo everywhere).
- Mouse/touch first: a clickable fretboard and on-screen controls are the primary input; keyboard shortcuts are a bonus.
- Output goes to paper/PDF and to plain-text tab pasted into messages, notes or Ultimate Guitar.

## Capabilities and Constraints

- v1 (tab editor): multiple parts per song, standard notation + tab rendered together, note entry by clicking the staff or a fretboard, durations, rests, chord names above beats via a chord palette, capo and tuning per part, tempo/time signature, playback, undo/redo, local autosave, export to PDF/print and text tab.
- Shipped since v1: library, recording import + sync, stage teleprompter, setlists, accounts + Supabase sync, read-only share links.
- Later: synced lyrics, mic follow, AI assist, community.
- Undecided: rhythm notation depth (tuplets, ties, techniques such as bends/slides/hammer-ons) beyond the basics; Guitar Pro / MusicXML import/export.

## Product Principles

1. Fast capture beats perfect engraving — every common action is one click or tap.
2. Nothing is lost — autosave locally, undo everything.
3. Guitar-first — frets, strings, capo and tuning are the native language; notation is derived, never required.
4. Readable on a music stand — output must be clean enough to play from.
