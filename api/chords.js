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

  const prompt = `You are a guitar chord assistant. Generate a simple chord chart with lyrics for the song "${title}"${artist ? ` by ${artist}` : ''}.

Format it like this example — put chord names in [brackets] on lines ABOVE the lyric they apply to, matching the syllable position:

[G]         [C]         [G]
Here comes the sun, doo doo doo
[G]         [C]           [D]
Here comes the sun, and I say

Only output the chord/lyric text, no explanations. Keep it to one verse and one chorus. Use common open chords when possible.`

  try {
    const client = new OpenAI({ apiKey })
    const completion = await client.chat.completions.create({
      model: 'o4-mini',
      max_completion_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
    const content = completion.choices[0]?.message?.content || ''
    return res.status(200).json({ content })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
