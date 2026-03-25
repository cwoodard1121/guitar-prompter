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

  const prompt = `You are a guitar chord assistant. Generate a chord chart for the song "${title}"${artist ? ` by ${artist}` : ''}.

Use the real chord progression for the song. For the lyric lines, write simplified placeholder syllables (like "da da da" or "la la la") that match the rhythm and syllable count — do NOT reproduce any copyrighted lyrics.

Format: put chord names in [brackets] on lines ABOVE the lyric placeholder they apply to, aligned to the syllable position:

[Eb]          [Bb]         [Eb]
da da-da da   da da-da da  da da
[Eb]          [Bb]         [Cm]
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
