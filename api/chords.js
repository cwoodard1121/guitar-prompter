import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

const PROMPT = (title, artist) =>
  `You are a guitar chord assistant. Generate a simple chord chart with lyrics for the song "${title}"${artist ? ` by ${artist}` : ''}.

Format it like this example — put chord names in [brackets] on lines ABOVE the lyric they apply to, matching the syllable position:

[G]         [C]         [G]
Here comes the sun, doo doo doo
[G]         [C]           [D]
Here comes the sun, and I say

Only output the chord/lyric text, no explanations. Keep it to one verse and one chorus. Use common open chords when possible.`

export default async function handler(req, res) {
  const { title = '', artist = '', provider = 'anthropic' } = req.query

  if (!title) {
    return res.status(400).json({ error: 'title is required' })
  }

  const prompt = PROMPT(title, artist)

  try {
    if (provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' })

      const client = new OpenAI({ apiKey })
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }]
      })
      const content = completion.choices[0]?.message?.content || ''
      return res.status(200).json({ content })
    } else {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

      const client = new Anthropic({ apiKey })
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }]
      })
      const content = message.content[0]?.text || ''
      return res.status(200).json({ content })
    }
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
