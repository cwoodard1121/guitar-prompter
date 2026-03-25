// In-memory store for songs (will reset on server restart in dev)
// For production, swap this out with a real database
let songsDb = {}

// Initialize from env if available (for persistence across restarts)
function initDb() {
  try {
    if (process.env.SONGS_DATA) {
      songsDb = JSON.parse(process.env.SONGS_DATA)
    }
  } catch (e) {
    console.error('Failed to load songs from env:', e)
    songsDb = {}
  }
}

initDb()

function saveDb() {
  // Optional: persist to env (requires server restart to take effect)
  // In production, this should save to a real database
}

export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const { method, query, body } = req
  const { id } = query

  try {
    if (method === 'GET') {
      if (id) {
        // Get single song
        const song = songsDb[id]
        if (!song) {
          return res.status(404).json({ error: 'Song not found' })
        }
        return res.status(200).json(song)
      } else {
        // Get all songs
        return res.status(200).json(Object.values(songsDb))
      }
    }

    if (method === 'POST') {
      // Create new song
      const songId = Date.now().toString()
      const newSong = { id: songId, ...body }
      songsDb[songId] = newSong
      saveDb()
      return res.status(201).json(newSong)
    }

    if (method === 'PUT') {
      // Update song
      if (!id) {
        return res.status(400).json({ error: 'Song ID required' })
      }
      if (!songsDb[id]) {
        return res.status(404).json({ error: 'Song not found' })
      }
      songsDb[id] = { ...songsDb[id], ...body, id }
      saveDb()
      return res.status(200).json(songsDb[id])
    }

    if (method === 'DELETE') {
      // Delete song
      if (!id) {
        return res.status(400).json({ error: 'Song ID required' })
      }
      if (!songsDb[id]) {
        return res.status(404).json({ error: 'Song not found' })
      }
      delete songsDb[id]
      saveDb()
      return res.status(200).json({ success: true })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('Songs API error:', e)
    res.status(500).json({ error: e.message || 'Server error' })
  }
}
