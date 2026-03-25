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
        reasoning_effort: 'low',
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
      reasoning_effort: 'low',
      messages: [{ role: 'user', content: CHORD_PROMPT(title, artist) }]
    })
    return res.status(200).json({ content: completion.choices[0]?.message?.content || '' })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
