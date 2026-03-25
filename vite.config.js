import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

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
      server.middlewares.use('/api/chords', async (req, res) => {
        const url = new URL(req.url, 'http://localhost')
        const title = url.searchParams.get('title') || ''
        const artist = url.searchParams.get('artist') || ''

        const send = (code, data) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(data))
        }

        if (!title) return send(400, { error: 'title is required' })

        const apiKey = env.OPENAI_API_KEY
        if (!apiKey) return send(500, { error: 'OPENAI_API_KEY not configured' })

        try {
          const client = new OpenAI({ apiKey })
          const completion = await client.chat.completions.create({
            model: 'o4-mini',
            max_completion_tokens: 4096,
            reasoning_effort: 'low',
            messages: [{ role: 'user', content: CHORD_PROMPT(title, artist) }]
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
        name: 'Guitar Prompter',
        short_name: 'GuitarP',
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
