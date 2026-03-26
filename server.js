import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

const PASSWORD = process.env.SITE_PASSWORD || null

// ── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

function rowToSong(row) {
  return {
    id: row.id,
    title: row.title ?? '',
    artist: row.artist ?? '',
    content: row.content ?? '',
    syncedLyrics: row.synced_lyrics ?? null,
    youtubeId: row.youtube_id ?? null
  }
}

function songToRow(song) {
  return {
    title: song.title ?? '',
    artist: song.artist ?? '',
    content: song.content ?? '',
    synced_lyrics: song.syncedLyrics ?? null,
    youtube_id: song.youtubeId ?? null
  }
}

// ── Password protection ─────────────────────────────────────────────────────
// Simple cookie-based gate. Set SITE_PASSWORD env var to enable.
if (PASSWORD) {
  app.use((req, res, next) => {
    // Always allow the login page and auth endpoint
    if (req.path === '/login' || req.path === '/api/auth') return next()

    const cookies = parseCookies(req.headers.cookie || '')
    if (cookies['gp-auth'] === PASSWORD) return next()

    // API calls get a 401 instead of redirect
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Redirect everything else to login
    res.redirect('/login')
  })

  app.get('/login', (_req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Guitar Prompter — Login</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0 }
    body { background: #1a1a2e; color: #eee; font-family: system-ui, sans-serif;
           display: flex; align-items: center; justify-content: center; min-height: 100dvh }
    .card { background: #16213e; border-radius: 12px; padding: 2rem; width: min(340px, 90vw);
            display: flex; flex-direction: column; gap: 1rem; box-shadow: 0 8px 32px #0006 }
    h1 { font-size: 1.3rem; text-align: center }
    p { font-size: 0.85rem; color: #888; text-align: center }
    input { width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid #333;
            background: #0f3460; color: #eee; font-size: 1rem; outline: none }
    input:focus { border-color: #e94560 }
    button { width: 100%; padding: 0.85rem; border-radius: 8px; border: none;
             background: #e94560; color: #fff; font-size: 1rem; font-weight: 700; cursor: pointer }
    .err { color: #e94560; font-size: 0.85rem; text-align: center; display: none }
  </style>
</head>
<body>
  <div class="card">
    <h1>🎸 Guitar Prompter</h1>
    <p>Alpha — friends only</p>
    <input id="pw" type="password" placeholder="Password" autofocus />
    <button onclick="login()">Enter</button>
    <div class="err" id="err">Wrong password</div>
  </div>
  <script>
    document.getElementById('pw').addEventListener('keydown', e => e.key === 'Enter' && login())
    async function login() {
      const pw = document.getElementById('pw').value
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw })
      })
      if (r.ok) { location.href = '/' }
      else { document.getElementById('err').style.display = 'block' }
    }
  </script>
</body>
</html>`)
  })

  app.post('/api/auth', express.json(), (req, res) => {
    if (req.body?.password === PASSWORD) {
      res.setHeader('Set-Cookie', `gp-auth=${PASSWORD}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`)
      return res.json({ ok: true })
    }
    res.status(401).json({ error: 'Wrong password' })
  })
}

// ── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json())

// ── Songs CRUD ──────────────────────────────────────────────────────────────
app.get('/api/songs', async (_req, res) => {
  const { data, error } = await supabase.from('songs').select('*').order('created_at')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data.map(rowToSong))
})

app.post('/api/songs', async (req, res) => {
  const id = Date.now().toString()
  const { data, error } = await supabase
    .from('songs').insert({ id, ...songToRow(req.body) }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(rowToSong(data))
})

app.put('/api/songs', async (req, res) => {
  const id = req.query.id
  if (!id) return res.status(400).json({ error: 'id is required' })
  const { data, error } = await supabase
    .from('songs').update(songToRow(req.body)).eq('id', id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'song not found' })
  res.json(rowToSong(data))
})

app.delete('/api/songs', async (req, res) => {
  const id = req.query.id
  if (!id) return res.status(400).json({ error: 'id is required' })
  const { error } = await supabase.from('songs').delete().eq('id', id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// ── AI chord/lyrics endpoint ─────────────────────────────────────────────────
const CHORD_PROMPT = (title, artist) =>
  `You are a guitar chord assistant for simple strumming songs (country, folk, pop). Generate a chord chart for "${title}"${artist ? ` by ${artist}` : ''}.

Use standard open or barre chord names only — like G, Cadd9, D, Em, E7, Dsus2, A, Bm, F, etc. Do NOT use power chord notation (no A5, E5, etc.) and do NOT use tab notation. Keep it playable by a casual guitarist who reads chord names.

Use the real chord progression for the song. For the lyric lines, write simplified placeholder syllables (like "da da da" or "la la la") that match the rhythm and syllable count — do NOT reproduce any copyrighted lyrics.

Format: put chord names in [brackets] on lines ABOVE the lyric placeholder they apply to, aligned to the syllable position:

[G]           [Cadd9]      [D]
da da-da da   da da-da da  da da
[G]           [D]          [Em]
da da-da da   da da-da da  da-da-da

Only output the chord/lyric text, no explanations. Cover one verse and one chorus. Use the accurate chords for this song.`

app.get('/api/lyrics', async (req, res) => {
  const { title = '', artist = '' } = req.query
  if (!title) return res.status(400).json({ error: 'title is required' })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' })

  try {
    const client = new OpenAI({ apiKey })
    const completion = await client.chat.completions.create({
      model: 'o4-mini',
      max_completion_tokens: 4096,
      reasoning_effort: 'low',
      messages: [{ role: 'user', content: CHORD_PROMPT(title, artist) }]
    })
    res.json({ content: completion.choices[0]?.message?.content || '' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Serve built Vue app ──────────────────────────────────────────────────────
const distDir = path.join(__dirname, 'dist')
app.use(express.static(distDir))
app.get('/{*path}', (_req, res) => res.sendFile(path.join(distDir, 'index.html')))

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`Guitar Prompter running on :${PORT}`))

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseCookies(cookieHeader) {
  return Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('=').map(decodeURIComponent))
  )
}
