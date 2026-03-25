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

export default async function handler(req, res) {
  const { title = '', artist = '' } = req.query
  const path = req.url?.split('?')[0] || ''

  if (!title) {
    return res.status(400).json({ error: 'title is required' })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' })
  }

  // Lyrics endpoint: fetch from lyrics.ovh then align with chords
  if (path.includes('/lyrics')) {
    try {
      const lyricsUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist || 'unknown')}/${encodeURIComponent(title)}`
      const lyricsRes = await fetch(lyricsUrl)
      if (!lyricsRes.ok) {
        const errData = await lyricsRes.json().catch(() => ({}))
        return res.status(lyricsRes.status).json({ error: errData.error || 'Could not find lyrics' })
      }
      const lyricsData = await lyricsRes.json()
      const rawLyrics = lyricsData.lyrics
      if (!rawLyrics) return res.status(404).json({ error: 'No lyrics found' })

      const client = new OpenAI({ apiKey })
      const completion = await client.chat.completions.create({
        model: 'o4-mini',
        max_completion_tokens: 16384,
        reasoning_effort: 'medium',
        messages: [{ role: 'user', content: LYRIC_ALIGN_PROMPT(title, artist, rawLyrics) }]
      })
      const content = completion.choices[0]?.message?.content || ''
      return res.status(200).json({ content, rawLyrics })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // Chords endpoint: placeholder syllables
  try {
    const client = new OpenAI({ apiKey })
    const completion = await client.chat.completions.create({
      model: 'o4-mini',
      max_completion_tokens: 32768,
      reasoning_effort: 'medium',
      messages: [{ role: 'user', content: CHORD_PROMPT(title, artist) }]
    })
    return res.status(200).json({ content: completion.choices[0]?.message?.content || '' })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
