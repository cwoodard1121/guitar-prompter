import { config } from 'dotenv'
config({ path: '.env.local' })
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import path from 'path'
import { fileURLToPath } from 'url'
import OpenAI, { toFile } from 'openai'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

// ── JWT helpers ──────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.warn('WARNING: JWT_SECRET is missing or too short. Auth will not work securely.')
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

function setAuthCookie(res, token) {
  res.cookie('gp-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days in ms
  })
}

// ── Rate limiting ────────────────────────────────────────────────────────────
const loginAttempts = new Map() // ip -> { count, resetAt }

function checkRateLimit(ip) {
  const now = Date.now()
  const entry = loginAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 }
  if (now > entry.resetAt) {
    entry.count = 0
    entry.resetAt = now + 15 * 60 * 1000
  }
  return entry
}

// ── Admin ────────────────────────────────────────────────────────────────────
const ADMIN_EMAILS = new Set(['cameronwoodard1121@gmail.com'])

// ── Auth middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.cookies['gp-token']
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.clearCookie('gp-token')
    res.status(401).json({ error: 'Session expired' })
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!ADMIN_EMAILS.has(req.user.email)) {
      return res.status(403).json({ error: 'Admin only' })
    }
    next()
  })
}

// Optional auth — attaches user if logged in but doesn't block
function optionalAuth(req, res, next) {
  const token = req.cookies['gp-token']
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET) } catch { /* ignore */ }
  }
  next()
}

// ── Row mappers ──────────────────────────────────────────────────────────────
function rowToSong(row) {
  return {
    id: row.id,
    title: row.title ?? '',
    artist: row.artist ?? '',
    content: row.content ?? '',
    syncedLyrics: row.synced_lyrics ?? null,
    youtubeId: row.youtube_id ?? null,
    bpm: row.bpm ?? null,
    syncOffset: row.sync_offset ?? 0,
    isPublic: row.is_public ?? false,
    userId: row.user_id ?? null
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

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cookieParser())
app.use(express.json())

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// ── Auth endpoints ───────────────────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body || {}

  // Validate
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Valid email required' })
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  const cleanEmail = email.trim().toLowerCase()

  try {
    // Check if email taken
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (existing) return res.status(409).json({ error: 'Email already registered' })

    // Hash password
    const password_hash = await bcrypt.hash(password, 12)

    // Create user
    const { data: user, error } = await supabase
      .from('users')
      .insert({ email: cleanEmail, password_hash })
      .select('id, email, display_name, created_at')
      .single()

    if (error) throw error

    const token = signToken(user)
    setAuthCookie(res, token)
    res.json({ user: { id: user.id, email: user.email, displayName: user.display_name } })
  } catch (e) {
    console.error('Register error:', e)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown'
  const entry = checkRateLimit(ip)

  if (entry.count >= 5) {
    const retryAfter = Math.ceil((entry.resetAt - Date.now()) / 1000)
    return res.status(429).json({ error: `Too many attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.` })
  }

  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const cleanEmail = email.trim().toLowerCase()

  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, email, display_name, password_hash')
      .eq('email', cleanEmail)
      .maybeSingle()

    // Use constant-time compare even on "not found" to prevent user enumeration
    const hash = user?.password_hash || '$2a$12$invalidhashforcomparison000000000000000000000000000'
    const valid = await bcrypt.compare(password, hash)

    if (!user || !valid) {
      entry.count++
      loginAttempts.set(ip, entry)
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Success — reset rate limit
    loginAttempts.delete(ip)

    const token = signToken(user)
    setAuthCookie(res, token)
    res.json({ user: { id: user.id, email: user.email, displayName: user.display_name } })
  } catch (e) {
    console.error('Login error:', e)
    res.status(500).json({ error: 'Login failed' })
  }
})

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('gp-token', { httpOnly: true, sameSite: 'strict' })
  res.json({ ok: true })
})

// GET /api/auth/me
app.get('/api/auth/me', requireAuth, async (req, res) => {
  const { data } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', req.user.id)
    .single()
  res.json({ user: {
    id: req.user.id,
    email: req.user.email,
    displayName: data?.display_name ?? null,
    isAdmin: ADMIN_EMAILS.has(req.user.email)
  } })
})

// PUT /api/auth/profile
app.put('/api/auth/profile', requireAuth, async (req, res) => {
  const displayName = (req.body.displayName ?? '').trim().slice(0, 50)
  const { error } = await supabase
    .from('users')
    .update({ display_name: displayName || null })
    .eq('id', req.user.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true, displayName: displayName || null })
})

// ── Songs CRUD ──────────────────────────────────────────────────────────────
app.get('/api/songs', optionalAuth, async (req, res) => {
  let query = supabase.from('songs').select('*').order('created_at', { ascending: false })

  if (req.user) {
    // Logged in: own songs + global (null user_id) songs
    query = query.or(`user_id.eq.${req.user.id},user_id.is.null`)
  } else {
    // Not logged in: only global songs
    query = query.is('user_id', null)
  }

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data.map(rowToSong))
})

app.post('/api/songs', optionalAuth, async (req, res) => {
  const id = Date.now().toString()
  const row = {
    ...songToRow(req.body),
    user_id: req.user?.id ?? null,
    is_public: req.body.isPublic ?? false
  }
  const { data, error } = await supabase
    .from('songs').insert({ id, ...row }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(rowToSong(data))
})

app.put('/api/songs', optionalAuth, async (req, res) => {
  const id = req.query.id
  if (!id) return res.status(400).json({ error: 'id is required' })

  const row = {
    ...songToRow(req.body),
    is_public: req.body.isPublic ?? false
  }

  // Fetch existing song to check ownership
  const { data: existing } = await supabase
    .from('songs')
    .select('user_id')
    .eq('id', id)
    .maybeSingle()

  if (existing?.user_id && existing.user_id !== req.user?.id) {
    return res.status(403).json({ error: 'Not authorized to edit this song' })
  }

  const { data, error } = await supabase
    .from('songs').update(row).eq('id', id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'song not found' })
  res.json(rowToSong(data))
})

app.delete('/api/songs', optionalAuth, async (req, res) => {
  const id = req.query.id
  if (!id) return res.status(400).json({ error: 'id is required' })

  // Fetch existing song to check ownership
  const { data: existing } = await supabase
    .from('songs')
    .select('user_id')
    .eq('id', id)
    .maybeSingle()

  if (existing?.user_id && existing.user_id !== req.user?.id) {
    return res.status(403).json({ error: 'Not authorized to delete this song' })
  }

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
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'no key' })
  try {
    const completion = await openai.chat.completions.create({
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
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'no key' })

  const { audio, mimeType } = req.body
  if (!audio) return res.status(400).json({ error: 'audio is required' })

  try {
    const buffer = Buffer.from(audio, 'base64')
    const ext    = mimeType?.includes('mp4') ? 'mp4' : 'webm'
    const file   = await toFile(buffer, `chunk.${ext}`, { type: mimeType || 'audio/webm' })
    const result = await openai.audio.transcriptions.create({ model: 'whisper-1', file })
    res.json({ text: result.text || '' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── AI chord format/validate endpoint ────────────────────────────────────────
const VALIDATE_PROMPT = (content) =>
  `You are a guitar chord formatter. The user has pasted a tab and it has been auto-formatted into bracket chord notation. Review it and fix any issues.

Rules:
- Chord names must be in [brackets] (e.g. [G], [Cadd9], [D/F#])
- Fix malformed brackets (e.g. "G]" → "[G]", "[G" → "[G]")
- Fix obviously wrong chord names (e.g. [Gm7b5] is fine, [XYZ] is not a chord — remove it)
- Keep all lyrics and content exactly as-is — only fix chord formatting
- Do NOT add, remove, or reorder any lines
- Return only the corrected text, no explanations

Content to review:
${content}`

app.post('/api/chords', async (req, res) => {
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' })

  const { content } = req.body || {}
  if (!content) return res.status(400).json({ error: 'content is required' })

  try {
    const completion = await openai.chat.completions.create({
      model: 'o4-mini',
      max_completion_tokens: 4096,
      reasoning_effort: 'low',
      messages: [{ role: 'user', content: VALIDATE_PROMPT(content) }]
    })
    res.json({ content: completion.choices[0]?.message?.content || '' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── AI chord/lyrics endpoint (web search + cache) ────────────────────────────
app.get('/api/lyrics', async (req, res) => {
  const { title = '', artist = '' } = req.query
  if (!title) return res.status(400).json({ error: 'title is required' })
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' })

  const titleKey  = title.trim().toLowerCase()
  const artistKey = artist.trim().toLowerCase()

  // Check cache first
  const { data: cached } = await supabase
    .from('chord_cache')
    .select('content')
    .eq('title_key', titleKey)
    .eq('artist_key', artistKey)
    .maybeSingle()

  if (cached) return res.json({ content: cached.content, cached: true })

  // Cache miss — call OpenAI web search
  try {
    const response = await openai.responses.create({
      model: 'gpt-4o-mini',
      tools: [{ type: 'web_search_preview', search_context_size: 'low' }],
      input: `Search for the guitar tab for "${title}"${artist ? ` by ${artist}` : ''} on Ultimate Guitar or a similar tab site and return the chord chart.

Format: chord names in [brackets] on the line ABOVE the words they apply to, like this:

[G]        [C]        [D]
Verse line one here
[Em]       [C]
Verse line two here

Include verse 1 and the chorus. Output ONLY the chord chart text — no markdown, no explanation, no "here is the chord chart" intro.`
    })

    const content = response.output_text || ''

    // Store in cache — fire-and-forget, don't fail the request on cache write errors
    supabase.from('chord_cache').insert({
      title: title.trim(),
      artist: artist.trim(),
      title_key: titleKey,
      artist_key: artistKey,
      content,
    }).catch(() => {})

    res.json({ content })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Community endpoints ───────────────────────────────────────────────────────
app.get('/api/community', optionalAuth, async (req, res) => {
  const q = req.query.q?.toLowerCase() || ''
  const page = parseInt(req.query.page) || 1
  const limit = 24
  const offset = (page - 1) * limit

  let query = supabase
    .from('songs')
    .select(`
      id, title, artist, likes_count, user_id,
      users:user_id ( display_name, email )
    `, { count: 'exact' })
    .eq('is_public', true)
    .order('likes_count', { ascending: false })
    .range(offset, offset + limit - 1)

  if (q) {
    query = query.or(`title.ilike.%${q}%,artist.ilike.%${q}%`)
  }

  const { data, error, count } = await query
  if (error) return res.status(500).json({ error: error.message })

  let likedIds = new Set()
  if (req.user) {
    const { data: likes } = await supabase
      .from('song_likes')
      .select('song_id')
      .eq('user_id', req.user.id)
    if (likes) likedIds = new Set(likes.map(l => l.song_id))
  }

  const songs = (data || []).map(row => ({
    id: row.id,
    title: row.title ?? '',
    artist: row.artist ?? '',
    likesCount: row.likes_count ?? 0,
    contributor: row.users?.display_name || (row.users?.email ? row.users.email.split('@')[0] : 'Anonymous'),
    liked: likedIds.has(row.id)
  }))

  res.json({ songs, total: count ?? 0, page, limit })
})

app.post('/api/community/:id/like', requireAuth, async (req, res) => {
  const songId = req.params.id
  const userId = req.user.id

  const { data: existing } = await supabase
    .from('song_likes')
    .select('song_id')
    .eq('user_id', userId)
    .eq('song_id', songId)
    .single()

  if (existing) {
    await supabase.from('song_likes').delete().eq('user_id', userId).eq('song_id', songId)
    const { data: song } = await supabase
      .from('songs')
      .select('likes_count')
      .eq('id', songId)
      .single()
    const newCount = Math.max(0, (song?.likes_count ?? 1) - 1)
    await supabase.from('songs').update({ likes_count: newCount }).eq('id', songId)
    const { data: updated } = await supabase.from('songs').select('likes_count').eq('id', songId).single()
    return res.json({ liked: false, likesCount: updated?.likes_count ?? 0 })
  } else {
    await supabase.from('song_likes').insert({ user_id: userId, song_id: songId })
    const { data: song } = await supabase.from('songs').select('likes_count').eq('id', songId).single()
    const newCount = (song?.likes_count ?? 0) + 1
    await supabase.from('songs').update({ likes_count: newCount }).eq('id', songId)
    return res.json({ liked: true, likesCount: newCount })
  }
})

// ── Admin endpoints ──────────────────────────────────────────────────────────

app.get('/api/admin/songs', requireAdmin, async (_req, res) => {
  const { data, error } = await supabase
    .from('songs')
    .select('id, title, artist, is_public, likes_count, user_id, created_at, users:user_id ( email )')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  const songs = (data || []).map(row => ({
    id: row.id,
    title: row.title ?? '',
    artist: row.artist ?? '',
    isPublic: row.is_public ?? false,
    likesCount: row.likes_count ?? 0,
    ownerEmail: row.users?.email ?? null,
    createdAt: row.created_at
  }))
  res.json(songs)
})

app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, display_name, created_at')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })

  // Get song counts per user
  const { data: counts } = await supabase
    .from('songs')
    .select('user_id')
    .not('user_id', 'is', null)
  const countMap = {}
  ;(counts || []).forEach(r => { countMap[r.user_id] = (countMap[r.user_id] || 0) + 1 })

  res.json((users || []).map(u => ({
    id: u.id,
    email: u.email,
    displayName: u.display_name ?? null,
    songCount: countMap[u.id] ?? 0,
    createdAt: u.created_at
  })))
})

app.put('/api/admin/songs/:id/unpublish', requireAdmin, async (req, res) => {
  const { error } = await supabase
    .from('songs')
    .update({ is_public: false, likes_count: 0 })
    .eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  // Clean up song_likes for this song
  await supabase.from('song_likes').delete().eq('song_id', req.params.id)
  res.json({ ok: true })
})

app.delete('/api/admin/songs/:id', requireAdmin, async (req, res) => {
  await supabase.from('song_likes').delete().eq('song_id', req.params.id)
  const { error } = await supabase.from('songs').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// ── Serve built Vue app ──────────────────────────────────────────────────────
const distDir = path.join(__dirname, 'dist')
app.use(express.static(distDir))
app.get('/{*path}', (_req, res) => res.sendFile(path.join(distDir, 'index.html')))

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`Guitar Portal running on :${PORT}`))
