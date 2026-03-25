import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import OpenAI from 'openai'

const CHORD_PROMPT = (title, artist) =>
  `You are a guitar chord expert. Generate a chord chart for "${title}"${artist ? ` by ${artist}` : ''}.

STEP 1 - RESEARCH: Before generating chords, think carefully about what the ACTUAL chord progression is for this specific song. Recall the real chords from guitar tabs, sheet music, and live performances. Do NOT default to generic progressions.

STEP 2 - VERIFY: Double-check your chord choices. Many classic rock/country songs have VERY SIMPLE progressions (2-4 chords). The verse of a song is often simpler than the chorus. Common patterns:
- I-V (D-A, G-D, C-G) — very common in rock verses
- I-IV-V (G-C-D, A-D-E) — classic rock/country
- I-V-vi-IV (G-D-Em-C, C-G-Am-F) — modern pop
- vi-IV-I-V (Am-F-C-G) — another pop pattern

STEP 3 - OUTPUT: Return ONLY valid JSON, no other text:
{
  "sections": [
    {
      "name": "Verse 1",
      "lines": [
        {"chords": ["D", "A"], "text": "da da da da    da da da da"},
        {"chords": ["D", "A"], "text": "da da da da    da da da da"}
      ]
    }
  ]
}

RULES:
- Each "chords" array lists the chord names in order of appearance on that line
- Each "text" has placeholder syllables matching the rhythm — do NOT reproduce lyrics
- Cover the FULL song: all verses, choruses, bridge, outro
- Use standard named chords: D, A, G, C, Em, Am, Bm, Dsus4, A7, D/F#, G/B, etc.
- Output ONLY the JSON object, nothing else`

const LYRIC_ALIGN_PROMPT = (title, artist, lyrics) =>
  `You are a guitar chord expert. Generate a chord chart for "${title}"${artist ? ` by ${artist}` : ''} aligned to the real lyrics below.

STEP 1 - RESEARCH: Think carefully about the ACTUAL chord progression for this song. Recall from guitar tabs, sheet music, live performances. Do NOT default to generic progressions.

STEP 2 - VERIFY: Double-check your choices. Many songs have simple progressions (2-4 chords). Verse is often simpler than chorus.

STEP 3 - OUTPUT: Return ONLY valid JSON:
{
  "sections": [
    {
      "name": "Verse 1",
      "lines": [
        {"chords": ["D", "A"], "text": "I got my first real six string"},
        {"chords": ["D", "A"], "text": "Bought it at the five and dime"}
      ]
    }
  ]
}

RULES:
- Each "chords" array lists chords in order for that line
- Each "text" is the actual lyric line
- Cover the FULL song
- Output ONLY the JSON object, nothing else

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
            max_completion_tokens: 32768,
            reasoning_effort: 'medium',
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
            reasoning_effort: 'medium',
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
