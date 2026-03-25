import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import OpenAI from 'openai'

const CHORD_PROMPT = (title, artist) =>
  `You are a guitar chord assistant. Generate a chord chart for the song "${title}"${artist ? ` by ${artist}` : ''}.

Use the real chord progression for the song. For the lyric lines, write simplified placeholder syllables (like "da da da" or "la la la") that match the rhythm and syllable count — do NOT reproduce any copyrighted lyrics.

Format: put chord names in [brackets] on lines ABOVE the lyric placeholder they apply to, aligned to the syllable position:

[Eb]          [Bb]         [Eb]
da da-da da   da da-da da  da da
[Eb]          [Bb]         [Cm]
da da-da da   da da-da da  da-da-da

Only output the chord/lyric text, no explanations. Cover the FULL song including all verses, choruses, and bridge if present. Use the accurate chords for this song.`

const LYRIC_ALIGN_PROMPT = (title, artist, lyrics) =>
  `You are a guitar chord assistant. Below are the real lyrics for "${title}"${artist ? ` by ${artist}` : ''}. 

Generate a chord chart aligned to these lyrics. Put chord names in [brackets] on the line ABOVE each lyric line, positioned to match where the chord changes happen:

[Eb]          [Bb]         [Eb]
Do you have the time to listen to me whine

Rules:
- Use the real, accurate chord progression for this song
- Align chord names above the exact word/syllable where the chord changes
- Cover the FULL song — every verse, chorus, bridge, and outro from the lyrics below
- Use standard named chords (G, C, D, Em, Am, Bb, Eb, etc.)
- Only output the chord/lyric text, no explanations or extra text

LYRICS:
${lyrics}`

function apiMiddlewarePlugin(env) {
  return {
    name: 'api-middleware',
    configureServer(server) {
      // Suggest chords with placeholder syllables (no real lyrics)
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
            max_completion_tokens: 16384,
            reasoning_effort: 'low',
            messages: [{ role: 'user', content: CHORD_PROMPT(title, artist) }]
          })
          return send(200, { content: completion.choices[0]?.message?.content || '' })
        } catch (err) {
          return send(500, { error: err.message })
        }
      })

      // Fetch real lyrics and align with chords
      server.middlewares.use('/api/lyrics', async (req, res) => {
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
          // Step 1: Fetch lyrics from lyrics.ovh
          const lyricsUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist || 'unknown')}/${encodeURIComponent(title)}`
          const lyricsRes = await fetch(lyricsUrl)
          if (!lyricsRes.ok) {
            const errData = await lyricsRes.json().catch(() => ({}))
            return send(lyricsRes.status, { error: errData.error || 'Could not find lyrics' })
          }
          const lyricsData = await lyricsRes.json()
          const rawLyrics = lyricsData.lyrics
          if (!rawLyrics) return send(404, { error: 'No lyrics found' })

          // Step 2: Use OpenAI to align chords with the lyrics
          const client = new OpenAI({ apiKey })
          const completion = await client.chat.completions.create({
            model: 'o4-mini',
            max_completion_tokens: 16384,
            reasoning_effort: 'low',
            messages: [{ role: 'user', content: LYRIC_ALIGN_PROMPT(title, artist, rawLyrics) }]
          })
          const content = completion.choices[0]?.message?.content || ''
          return send(200, { content, rawLyrics })
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
