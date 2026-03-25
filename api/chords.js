import OpenAI from 'openai'

const CHORD_PROMPT = (title, artist) =>
  `You are a professional guitar tablature researcher. Generate an ACCURATE chord chart for "${title}"${artist ? ` by ${artist}` : ''}.

RESEARCH PROCESS - Do this step by step in your reasoning:
1. Recall the specific chord chart from authoritative guitar sources (ultimate-guitar.com, songsterr.com, official sheet music)
2. Identify which chords are used in EACH section separately (intro, verse, chorus, bridge)
3. Check if the song uses a capo. If the original guitar recording uses a capo, the chords shown on tabs are SHAPES relative to capo. Include "capo" field in JSON.
4. Verify: is your progression correct? Are you adding chords that aren't there? Simpler is usually more accurate.

CRITICAL ACCURACY RULES:
- Do NOT default to the I-V-vi-IV progression. Many songs are simpler.
- Verse sections often use only 1-2 chords. Do NOT add extra chords.
- If you recall the song uses capo 2, output the CHORD SHAPES as shown on tabs (e.g. "Em" shape with capo 2 = F#m actual)

OUTPUT FORMAT - Return ONLY valid JSON:
{
  "capo": 0,
  "sections": [
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
- Each "chords" array lists chord names in order of appearance
- Each "text" has placeholder syllables matching rhythm — do NOT reproduce lyrics
- Cover the FULL song
- Output ONLY the JSON, nothing else`

const LYRIC_ALIGN_PROMPT = (title, artist, lyrics) =>
  `You are a professional guitar tablature researcher. Generate an ACCURATE chord chart for "${title}"${artist ? ` by ${artist}` : ''} aligned to the real lyrics.

RESEARCH PROCESS - Do this step by step in your reasoning:
1. Recall the specific chord chart from authoritative guitar sources
2. Map each chord to the exact lyric line where it changes
3. Check if the song uses a capo on the original recording
4. Verify accuracy. Simpler progressions are usually correct.

CRITICAL ACCURACY RULES:
- Do NOT default to I-V-vi-IV. Many songs are simpler.
- Verse sections often use only 1-2 chords.
- If the song uses capo, include the capo fret number.

OUTPUT FORMAT - Return ONLY valid JSON:
{
  "capo": 0,
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
- Each "chords" array lists chords in order for that line
- Cover the FULL song
- Output ONLY the JSON, nothing else

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

  try {
    const client = new OpenAI({ apiKey })
    const completion = await client.chat.completions.create({
      model: 'o4-mini',
      max_completion_tokens: 32768,
      reasoning_effort: 'high',
      messages: [{ role: 'user', content: CHORD_PROMPT(title, artist) }]
    })
    return res.status(200).json({ content: completion.choices[0]?.message?.content || '' })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
