import Anthropic from '@anthropic-ai/sdk'

export default async function handler(req, res) {
  const { title = '', artist = '' } = req.query

  if (!title) {
    return res.status(400).json({ error: 'title is required' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  const client = new Anthropic({ apiKey })

  const prompt = `You are a guitar chord assistant. Generate a simple chord chart with lyrics for the song "${title}"${artist ? ` by ${artist}` : ''}.

Format it like this example — put chord names in [brackets] on lines ABOVE the lyric they apply to, matching the syllable position:

[G]         [C]         [G]
Here comes the sun, doo doo doo
[G]         [C]           [D]
Here comes the sun, and I say

Only output the chord/lyric text, no explanations. Keep it to one verse and one chorus. Use common open chords when possible.`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }]
    })

    const content = message.content[0]?.text || ''
    return res.status(200).json({ content })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
