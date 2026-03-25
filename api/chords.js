import OpenAI from 'openai'

const CHORD_PROMPT = (title, artist) =>
  `Generate the MOST ACCURATE guitar chord chart possible for "${title}"${artist ? ` by ${artist}` : ''}.

YOU MUST RESEARCH THIS. Do not guess. In your reasoning, work through each section one at a time.

STEP BY STEP RESEARCH:
1. Think: what genre? What era? What tuning?
2. For EACH section, determine the EXACT chord for EACH LINE. Chords change throughout a section — they are NOT the same for every line.
3. The verse chords are different from chorus chords. Within a verse, each line often has a DIFFERENT chord.
4. Check if the song uses a capo.
5. Cite your source URL.

CRITICAL — EACH LINE GETS ITS OWN CHORDS:
- Do NOT repeat the same chords for every line in a section
- Each line has its own chord or chords where the change happens
- Example of WRONG (repeating): {"chords":["E","A"], "text":"line 1"}, {"chords":["E","A"], "text":"line 2"}
- Example of RIGHT (per-line): {"chords":["E"], "text":"line 1"}, {"chords":["D"], "text":"line 2"}, {"chords":["A"], "text":"line 3"}, {"chords":["E"], "text":"line 4"}
- A chord array with multiple chords means they change WITHIN that line: {"chords":["D","A"], "text":"line with two chords"}
- Transition chords at end of line: {"chords":["E","B"], "text":"end of phrase"}

OUTPUT — ONLY valid JSON:
{
  "capo": 0,
  "source": "URL or source name",
  "sections": [
    {"name": "Intro", "lines": [{"chords": ["C#m","A","E","B"], "text": ""}]},
    {"name": "Verse 1", "lines": [
      {"chords": ["E"], "text": "da da da da da da"},
      {"chords": ["D"], "text": "da da da da da da"},
      {"chords": ["A"], "text": "da da da da da da"},
      {"chords": ["E"], "text": "da da da da da da da da da"}
    ]},
    {"name": "Chorus", "lines": [
      {"chords": ["C#m","A","E","B"], "text": "da da da da da da"},
      {"chords": ["C#m","A","E","B"], "text": "da da da da da da"}
    ]}
  ]
}

RULES:
- Cover the FULL song with every section and every line
- "text": placeholder syllables matching rhythm. Empty "" for instrumental.
- Output ONLY the JSON, nothing else`

const LYRIC_ALIGN_PROMPT = (title, artist, lyrics) =>
  `Generate the MOST ACCURATE guitar chord chart for "${title}"${artist ? ` by ${artist}` : ''} aligned to the real lyrics below.

YOU MUST RESEARCH THIS. In your reasoning, work through each section one at a time.

STEP BY STEP:
1. Read the lyrics and identify each section
2. For EACH LYRIC LINE, determine the EXACT chord. Each line often has a DIFFERENT chord.
3. Chords change WITHIN lines too — a line might go from D to A mid-sentence.
4. Add intro/interlude sections (no lyrics) before verse sections.
5. Cite your source URL.

CRITICAL — EACH LINE GETS ITS OWN CHORDS:
- Do NOT repeat the same chords for every line
- Each line has its own chord(s) where the change happens
- Example of WRONG: {"chords":["E","A"], "text":"line 1"}, {"chords":["E","A"], "text":"line 2"}
- Example of RIGHT: {"chords":["E"], "text":"Now if you're feeling kinda low"}, {"chords":["D"], "text":"'bout the dues you've been paying"}, {"chords":["A"], "text":"Future's coming much too slow"}, {"chords":["E"], "text":"And you wanna run..."}
- Multiple chords in one array means they change within that line
- Transition chords at end: {"chords":["E","B"], "text":"end of phrase"}

OUTPUT — ONLY valid JSON:
{
  "capo": 0,
  "source": "URL or source name",
  "sections": [
    {"name": "Intro", "lines": [{"chords": ["C#m","A","E","B"], "text": ""}]},
    {"name": "Verse 1", "lines": [
      {"chords": ["E"], "text": "Now if you're feeling kinda low"},
      {"chords": ["D"], "text":"'bout the dues you've been paying"},
      {"chords": ["A","E"], "text": "Future's coming much too slow"},
      {"chords": ["E"], "text": "And you wanna run but somehow you just keep on staying"},
      {"chords": ["D"], "text": "Can't decide on which way to go"},
      {"chords": ["A","B"], "text": "Yeah yeah yeah"}
    ]}
  ]
}

RULES:
- Cover the FULL song including intros, outros
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
        max_completion_tokens: 32768,
        reasoning_effort: 'high',
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
