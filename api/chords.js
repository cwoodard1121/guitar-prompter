import OpenAI from 'openai'

export default async function handler(req, res) {
  const { title = '', artist = '' } = req.query

  if (!title) {
    return res.status(400).json({ error: 'title is required' })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' })
  }

  const prompt = `You are a guitar chord assistant for simple strumming songs (country, folk, pop). Generate a chord chart for "${title}"${artist ? ` by ${artist}` : ''}.

Use standard open or barre chord names only — like G, Cadd9, D, Em, E7, Dsus2, A, Bm, F, etc. Do NOT use power chord notation (no A5, E5, etc.) and do NOT use tab notation. Keep it playable by a casual guitarist who reads chord names.

Use the real chord progression for the song. For the lyric lines, write simplified placeholder syllables (like "da da da" or "la la la") that match the rhythm and syllable count — do NOT reproduce any copyrighted lyrics.

Format: put chord names in [brackets] on lines ABOVE the lyric placeholder they apply to, aligned to the syllable position:

[G]           [Cadd9]      [D]
da da-da da   da da-da da  da da
[G]           [D]          [Em]
da da-da da   da da-da da  da-da-da

Only output the chord/lyric text, no explanations. Cover one verse and one chorus. Use the accurate chords for this song.`

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
