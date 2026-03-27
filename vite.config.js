import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import OpenAI, { toFile } from 'openai'
import fs from 'fs'
import path from 'path'

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
          return send(200, { content: response.output_text || '' })
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
          return send(405, { error: 'method not allowed' })
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
