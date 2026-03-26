import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const message = await client.messages.create({
  model: "claude-opus-4-6",
  max_tokens: 4000,
  thinking: {
    type: "adaptive",
  },
  output_config: {
    effort: "medium",
  },
  messages: [
    {
      role: "user",
      content: `Analyze this JavaScript chord positioning code for bugs. The issue is that when parsing inline chords like "[G]long, [D/F#]long tim[Em]e ago", some chords are misaligned and cluster at the start instead of spreading correctly.

function convertInlineChords(line) {
  const chordPattern = /\[([A-G][#b]?(?:m(?:aj7|7)?|7|sus2|sus4|add9|dim|aug|5)?(?:\/[A-G][#b]?)?)\]/g
  const chords = []
  const textParts = []
  let lastEnd = 0
  let lyricsPos = 0

  while ((m = chordPattern.exec(line)) !== null) {
    const textBefore = line.substring(lastEnd, m.index)
    textParts.push(textBefore)
    lyricsPos += textBefore.length
    chords.push({ chord: m[1], col: lyricsPos })
    lastEnd = m.index + m[0].length
  }

  textParts.push(line.substring(lastEnd))
  const lyric = textParts.join('')
  return alignChordToLyric(chords, lyric)
}

function alignChordToLyric(chords, lyric) {
  const sortedChords = [...chords].sort((a, b) => a.col - b.col)
  let chordLine = ''
  let lyricPos = 0

  for (const { chord, col } of sortedChords) {
    while (lyricPos < col) {
      chordLine += ' '
      lyricPos++
    }
    chordLine += \`[\${chord}]\`
  }

  return chordLine + '\n' + lyric
}

Trace through with: "A [G]long, [D/F#]long tim[Em]e ago"
Expected lyric: "A long, long time ago"
Should produce chords at correct positions, but are clustering at start instead.

Find the bug in position calculation.`,
    },
  ],
});

console.log("=== CHORD POSITIONING ANALYSIS ===\n");
for (const block of message.content) {
  if (block.type === "text") {
    console.log(block.text);
  }
}
