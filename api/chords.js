import OpenAI from 'openai'

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

const GENERATE_PROMPT = (title, artist) =>
  `You are a guitar chord assistant for simple strumming songs (country, folk, pop). Generate a chord chart for "${title}"${artist ? ` by ${artist}` : ''}.

Use standard open or barre chord names only — like G, Cadd9, D, Em, E7, Dsus2, A, Bm, F, etc. Do NOT use power chord notation (no A5, E5, etc.) and do NOT use tab notation. Keep it playable by a casual guitarist who reads chord names.

Use the real chord progression for the song. For the lyric lines, write simplified placeholder syllables (like "da da da" or "la la la") that match the rhythm and syllable count — do NOT reproduce any copyrighted lyrics.

Format: put chord names in [brackets] on lines ABOVE the lyric placeholder they apply to, aligned to the syllable position:

[G]           [Cadd9]      [D]
da da-da da   da da-da da  da da
[G]           [D]          [Em]
da da-da da   da da-da da  da-da-da

Only output the chord/lyric text, no explanations. Cover one verse and one chorus. Use the accurate chords for this song.`

export default async function handler(req, res) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' })
  }

  let prompt
  if (req.method === 'POST') {
    // Validation mode: fix formatting of existing content
    let body = req.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { body = {} }
    }
    const { content } = body || {}
    if (!content) return res.status(400).json({ error: 'content is required' })
    prompt = VALIDATE_PROMPT(content)
  } else {
    // Generation mode: create chord chart from title/artist
    const { title = '', artist = '' } = req.query
    if (!title) return res.status(400).json({ error: 'title is required' })
    prompt = GENERATE_PROMPT(title, artist)
  }

  try {
    const client = new OpenAI({ apiKey })
    const completion = await client.chat.completions.create({
      model: 'o4-mini',
      max_completion_tokens: 4096,
      reasoning_effort: 'low',
      messages: [{ role: 'user', content: prompt }]
    })
    const content = completion.choices[0]?.message?.content || ''
    return res.status(200).json({ content })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
