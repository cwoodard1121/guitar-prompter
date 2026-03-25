import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import OpenAI from 'openai'

const CHORD_PROMPT = (title, artist) =>
  `You are a professional guitar tablature researcher. Generate an ACCURATE chord chart for "${title}"${artist ? ` by ${artist}` : ''}.

RESEARCH PROCESS - Do this step by step in your reasoning:
1. Recall the specific chord chart from authoritative guitar sources (ultimate-guitar.com, songsterr.com, official sheet music)
2. Identify which chords are used in EACH section separately (intro, verse, chorus, bridge, outro)
3. Check if the song uses a capo. If the original guitar recording uses a capo, the chords shown on tabs are SHAPES relative to capo. Include "capo" field in JSON.
4. Verify: is your progression correct? Are you adding chords that aren't there? Simpler is usually more accurate.
5. For instrumental sections (intro, outro, interlude) with no lyrics, use empty string for "text" and only include "chords".

CRITICAL ACCURACY RULES:
- Do NOT default to the I-V-vi-IV progression. Many songs are simpler.
- Verse sections often use only 1-2 chords. Do NOT add extra chords.
- If you recall the song uses capo 2, output the CHORD SHAPES as shown on tabs (e.g. "Em" shape with capo 2 = F#m actual)
- For the "source" field: ONLY cite a source if you are highly confident. If unsure, write "AI-generated — verify manually". Do NOT make up URLs.

OUTPUT FORMAT - Return ONLY valid JSON:
{
  "capo": 0,
  "source": "ultimate-guitar.com (verify manually)",
  "sections": [
    {
      "name": "Intro",
      "lines": [
        {"chords": ["C#m", "A", "E", "B"], "text": ""}
      ]
    },
    {
      "name": "Verse 1",
      "lines": [
        {"chords": ["D", "A"], "text": "da da da da    da da da da"}
      ]
    }
  ]
}

RULES:
- "capo" is the fret number (0 if no capo). The chords in "chords" are the SHAPES the player fingers.
- "source" is where you got the chord data from. Be honest if unsure.
- Each "chords" array lists chord names in order of appearance
- Each "text" has placeholder syllables matching rhythm — do NOT reproduce lyrics. Empty string for instrumental sections.
- Cover the FULL song including intros, outros, interludes
- Output ONLY the JSON, nothing else`

const LYRIC_ALIGN_PROMPT = (title, artist, lyrics) =>
  `You are a professional guitar tablature researcher. Generate an ACCURATE chord chart for "${title}"${artist ? ` by ${artist}` : ''} aligned to the real lyrics.

RESEARCH PROCESS - Do this step by step in your reasoning:
1. Recall the specific chord chart from authoritative guitar sources
2. Map each chord to the exact lyric line where it changes
3. Check if the song uses a capo on the original recording
4. Verify accuracy. Simpler progressions are usually correct.
5. For instrumental sections (intro, outro) with no lyrics, use empty string for "text" and only include "chords".

CRITICAL ACCURACY RULES:
- Do NOT default to I-V-vi-IV. Many songs are simpler.
- Verse sections often use only 1-2 chords.
- If the song uses capo, include the capo fret number.
- For the "source" field: ONLY cite a source if you are highly confident. If unsure, write "AI-generated — verify manually". Do NOT make up URLs.

OUTPUT FORMAT - Return ONLY valid JSON:
{
  "capo": 0,
  "source": "ultimate-guitar.com (verify manually)",
  "sections": [
    {
      "name": "Verse 1",
      "lines": [
        {"chords": ["D", "A"], "text": "I got my first real six string"}
      ]
    }
  ]
}

RULES:
- "capo" is the fret number (0 if no capo). Chords are the SHAPES the player fingers.
- "source" is where you got the chord data. Be honest if unsure.
- Each "chords" array lists chords in order for that line
- Cover the FULL song including intros, outros
- Output ONLY the JSON, nothing else

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
            reasoning_effort: 'high',
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
            reasoning_effort: 'high',
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
