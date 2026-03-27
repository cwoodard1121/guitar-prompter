import { config } from 'dotenv'
config({ path: '.env.local' })
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import OpenAI, { toFile } from 'openai'
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
    youtubeId: row.youtube_id ?? null,
    bpm: row.bpm ?? null,
    syncOffset: row.sync_offset ?? 0
  }
}

function songToRow(song) {
  return {
    title: song.title ?? '',
    artist: song.artist ?? '',
    content: song.content ?? '',
    synced_lyrics: song.syncedLyrics ?? null,
    youtube_id: song.youtubeId ?? null,
    bpm: song.bpm ?? null,
    sync_offset: song.syncOffset ?? 0
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

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }))

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

// ── Setlists CRUD ────────────────────────────────────────────────────────────
app.get('/api/setlists', async (_req, res) => {
  const { data, error } = await supabase.from('setlists').select('*').order('created_at')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data.map(r => ({ id: r.id, name: r.name, songIds: r.song_ids ?? [] })))
})

app.post('/api/setlists', async (req, res) => {
  const id = Date.now().toString()
  const { data, error } = await supabase
    .from('setlists').insert({ id, name: req.body.name ?? '', song_ids: req.body.songIds ?? [] }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json({ id: data.id, name: data.name, songIds: data.song_ids })
})

app.put('/api/setlists', async (req, res) => {
  const id = req.query.id
  if (!id) return res.status(400).json({ error: 'id is required' })
  const { data, error } = await supabase
    .from('setlists').update({ name: req.body.name ?? '', song_ids: req.body.songIds ?? [] }).eq('id', id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json({ id: data.id, name: data.name, songIds: data.song_ids })
})

app.delete('/api/setlists', async (req, res) => {
  const id = req.query.id
  if (!id) return res.status(400).json({ error: 'id is required' })
  const { error } = await supabase.from('setlists').delete().eq('id', id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// ── AI title parse endpoint ──────────────────────────────────────────────────
app.get('/api/parse-title', async (req, res) => {
  const { raw } = req.query
  if (!raw) return res.status(400).json({ error: 'raw is required' })
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'no key' })
  try {
    const client = new OpenAI({ apiKey })
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 60,
      messages: [{ role: 'user', content: `Extract artist and song title from this YouTube video title. Return only JSON: {"artist":"...","title":"..."}\n\n"${raw}"` }]
    })
    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}')
    res.json(parsed)
  } catch { res.status(500).json({ error: 'parse failed' }) }
})

// ── Whisper transcription endpoint ──────────────────────────────────────────
app.post('/api/transcribe', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'no key' })

  const { audio, mimeType } = req.body
  if (!audio) return res.status(400).json({ error: 'audio is required' })

  try {
    const buffer = Buffer.from(audio, 'base64')
    const ext    = mimeType?.includes('mp4') ? 'mp4' : 'webm'
    const file   = await toFile(buffer, `chunk.${ext}`, { type: mimeType || 'audio/webm' })
    const client = new OpenAI({ apiKey })
    const result = await client.audio.transcriptions.create({ model: 'whisper-1', file })
    res.json({ text: result.text || '' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── AI chord/lyrics endpoint (web search) ────────────────────────────────────
app.get('/api/lyrics', async (req, res) => {
  const { title = '', artist = '' } = req.query
  if (!title) return res.status(400).json({ error: 'title is required' })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' })

  try {
    const client = new OpenAI({ apiKey })
    const response = await client.responses.create({
      model: 'gpt-4o-mini',
      tools: [{ type: 'web_search_preview', search_context_size: 'low' }],
      input: `Find the guitar chord chart for "${title}"${artist ? ` by ${artist}` : ''}. Search Ultimate Guitar or a similar tab site for the real chords and lyrics.

Return the result formatted exactly like this — chord names in [brackets] on the line ABOVE the lyric they apply to:

[G]        [C]        [D]
Here comes the sun little darling
[Em]       [C]
It's been a long cold lonely winter

Include verse 1 and the chorus. Return ONLY the formatted chord chart — no markdown, no explanation, no headers.`
    })
    res.json({ content: response.output_text || '' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Serve built Vue app ──────────────────────────────────────────────────────
const distDir = path.join(__dirname, 'dist')
app.use(express.static(distDir))
app.get('/{*path}', (_req, res) => res.sendFile(path.join(distDir, 'index.html')))

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`Guitar Portal running on :${PORT}`))

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseCookies(cookieHeader) {
  return Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('=').map(decodeURIComponent))
  )
}
