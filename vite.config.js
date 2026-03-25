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

Only output the chord/lyric text, no explanations. Cover one verse and one chorus. Use the accurate chords for this song.`

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
