import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

const CHORD_PROMPT_WITH_LYRICS = (title, artist, lyrics) =>
  `You are a guitar chord assistant. Add chord annotations to the lyrics of "${title}"${artist ? ` by ${artist}` : ''}.

Use standard open or barre chord names only (G, Cadd9, D, Em, E7, Dsus2, A, Bm, F, etc.). No power chords, no tab notation. Use the real chord progression for this song.

Put chord names in [brackets] on lines ABOVE the lyric line they apply to, aligned to the syllable where the chord changes:

[G]           [Cadd9]      [D]
Here comes the sun        little darling
[G]           [D]          [Em]
It's been a long cold lonely winter

Annotate verse 1 and the chorus. Output only the chord/lyric text, no explanations.

Lyrics:
${lyrics.slice(0, 3000)}`

const CHORD_PROMPT_FALLBACK = (title, artist) =>
  `You are a guitar chord assistant. Generate a chord chart for "${title}"${artist ? ` by ${artist}` : ''}.

Use standard open or barre chord names only — like G, Cadd9, D, Em, E7, Dsus2, A, Bm, F, etc. No power chords, no tab notation.

Use the real chord progression for the song. For lyric lines write simplified placeholder syllables (da da da, la la la) matching the rhythm — do NOT reproduce copyrighted lyrics.

Format: chord names in [brackets] above the syllable line they apply to:

[G]           [Cadd9]      [D]
da da-da da   da da-da da  da da

Only output the chord/lyric text, no explanations. Cover one verse and one chorus.`

const CHORD_PROMPT = CHORD_PROMPT_FALLBACK  // used by /api/chords validate path

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

const SONGS_FILE = path.resolve(process.cwd(), 'songs.json')

function readSongs() {
  try {
    return JSON.parse(fs.readFileSync(SONGS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function writeSongs(songs) {
  fs.writeFileSync(SONGS_FILE, JSON.stringify(songs, null, 2))
}

function songsMiddlewarePlugin() {
  return {
    name: 'songs-middleware',
    configureServer(server) {
      server.middlewares.use('/api/songs', async (req, res) => {
        const url = new URL(req.url, 'http://localhost')
        const id = url.searchParams.get('id')

        const send = (code, data) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(data))
        }

        const readBody = () => new Promise((resolve, reject) => {
          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', () => { try { resolve(JSON.parse(body)) } catch { reject(new Error('Invalid JSON')) } })
          req.on('error', reject)
        })

        if (req.method === 'GET') {
          return send(200, readSongs())
        }

        if (req.method === 'POST') {
          const data = await readBody()
          const songs = readSongs()
          const song = { ...data, id: Date.now().toString() }
          songs.push(song)
          writeSongs(songs)
          return send(201, song)
        }

        if (req.method === 'PUT') {
          if (!id) return send(400, { error: 'id is required' })
          const data = await readBody()
          const songs = readSongs()
          const idx = songs.findIndex(s => s.id === id)
          if (idx === -1) return send(404, { error: 'song not found' })
          songs[idx] = { ...songs[idx], ...data, id }
          writeSongs(songs)
          return send(200, songs[idx])
        }

        if (req.method === 'DELETE') {
          if (!id) return send(400, { error: 'id is required' })
          const songs = readSongs()
          const filtered = songs.filter(s => s.id !== id)
          writeSongs(filtered)
          return send(200, { ok: true })
        }

        return send(405, { error: 'method not allowed' })
      })
    }
  }
}

function apiMiddlewarePlugin(env) {
  return {
    name: 'api-middleware',
    configureServer(server) {
      server.middlewares.use('/api/transcribe', async (req, res) => {
        const send = (code, data) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(data))
        }
        if (req.method !== 'POST') return send(405, { error: 'method not allowed' })

        const apiKey = env.OPENAI_API_KEY
        if (!apiKey) return send(500, { error: 'OPENAI_API_KEY not configured' })

        let body = ''
        await new Promise((resolve, reject) => {
          req.on('data', chunk => { body += chunk })
          req.on('end', resolve)
          req.on('error', reject)
        })

        let parsed
        try { parsed = JSON.parse(body) } catch { return send(400, { error: 'Invalid JSON' }) }
        const { audio, mimeType } = parsed || {}
        if (!audio) return send(400, { error: 'audio is required' })

        try {
          const buffer = Buffer.from(audio, 'base64')
          const ext    = mimeType?.includes('mp4') ? 'mp4' : 'webm'
          const file   = await toFile(buffer, `chunk.${ext}`, { type: mimeType || 'audio/webm' })
          const client = new OpenAI({ apiKey })
          const result = await client.audio.transcriptions.create({ model: 'whisper-1', file })
          return send(200, { text: result.text || '' })
        } catch (err) {
          return send(500, { error: err.message })
        }
      })

      server.middlewares.use('/api/lyrics', async (req, res) => {
        const send = (code, data) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(data))
        }

        const apiKey = env.OPENAI_API_KEY
        if (!apiKey) return send(500, { error: 'OPENAI_API_KEY not configured' })

        const url = new URL(req.url, 'http://localhost')
        const title = url.searchParams.get('title') || ''
        const artist = url.searchParams.get('artist') || ''
        if (!title) return send(400, { error: 'title is required' })

        // Step 1: try to fetch plain lyrics from lrclib
        let plainLyrics = null
        try {
          const params = new URLSearchParams({ artist_name: artist, track_name: title })
          const lrcRes = await fetch(`https://lrclib.net/api/get?${params}`, {
            headers: { 'Lrclib-Client': 'guitar-portal/1.0' }
          })
          if (lrcRes.ok) {
            const lrcData = await lrcRes.json()
            plainLyrics = lrcData.plainLyrics || null
          }
        } catch { /* fall through */ }

        const prompt = plainLyrics
          ? CHORD_PROMPT_WITH_LYRICS(title, artist, plainLyrics)
          : CHORD_PROMPT_FALLBACK(title, artist)

        try {
          const client = new OpenAI({ apiKey })
          const completion = await client.chat.completions.create({
            model: 'o4-mini',
            max_completion_tokens: 4096,
            reasoning_effort: 'low',
            messages: [{ role: 'user', content: prompt }]
          })
          return send(200, { content: completion.choices[0]?.message?.content || '', hadLyrics: !!plainLyrics })
        } catch (err) {
          return send(500, { error: err.message })
        }
      })

      server.middlewares.use('/api/chords', async (req, res) => {
        const send = (code, data) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(data))
        }

        const apiKey = env.OPENAI_API_KEY
        if (!apiKey) return send(500, { error: 'OPENAI_API_KEY not configured' })

        let prompt
        if (req.method === 'POST') {
          let body = ''
          await new Promise((resolve, reject) => {
            req.on('data', chunk => { body += chunk })
            req.on('end', resolve)
            req.on('error', reject)
          })
          let parsed
          try { parsed = JSON.parse(body) } catch { return send(400, { error: 'Invalid JSON' }) }
          const { content } = parsed || {}
          if (!content) return send(400, { error: 'content is required' })
          prompt = VALIDATE_PROMPT(content)
        } else {
          const url = new URL(req.url, 'http://localhost')
          const title = url.searchParams.get('title') || ''
          const artist = url.searchParams.get('artist') || ''
          if (!title) return send(400, { error: 'title is required' })
          prompt = CHORD_PROMPT(title, artist)
        }

        try {
          const client = new OpenAI({ apiKey })
          const completion = await client.chat.completions.create({
            model: 'o4-mini',
            max_completion_tokens: 4096,
            reasoning_effort: 'low',
            messages: [{ role: 'user', content: prompt }]
          })
          return send(200, { content: completion.choices[0]?.message?.content || '' })
        } catch (err) {
          return send(500, { error: err.message })
        }
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [
    songsMiddlewarePlugin(),
    apiMiddlewarePlugin(env),
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'guitar-icon-192.png', 'guitar-icon-512.png'],
      manifest: {
        name: 'Guitar Portal',
        short_name: 'Guitar Portal',
        description: 'Guitar teleprompter with chords and lyrics',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'guitar-icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'guitar-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\./,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20 } }
          }
        ]
      }
    })
  ]}
})
