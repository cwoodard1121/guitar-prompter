<template>
  <div class="home">
    <header class="home-header">
      <h1>🎸 Guitar Prompter</h1>
      <div class="header-actions">
        <RouterLink to="/setlist/new" class="btn-add btn-setlist">+ Setlist</RouterLink>
        <RouterLink to="/song/new" class="btn-add">+ Song</RouterLink>
      </div>
    </header>

    <!-- Setlists -->
    <div v-if="setlistsStore.setlists.length > 0" class="section">
      <div class="section-title">Setlists</div>
      <ul class="setlist-list">
        <li v-for="setlist in setlistsStore.setlists" :key="setlist.id" class="setlist-card">
          <div class="setlist-info">
            <span class="setlist-name">{{ setlist.name }}</span>
            <span class="setlist-count">{{ setlist.songIds?.length ?? 0 }} songs</span>
          </div>
          <div class="song-actions">
            <RouterLink
              v-if="setlist.songIds?.length"
              :to="`/song/${setlist.songIds[0]}/play?setlist=${setlist.id}&idx=0`"
              class="btn btn-play"
            >▶ Play</RouterLink>
            <RouterLink :to="`/setlist/${setlist.id}/edit`" class="btn btn-edit">✏️</RouterLink>
          </div>
        </li>
      </ul>
    </div>

    <!-- Songs -->
    <div class="section">
      <div class="section-title">Songs</div>
      <input v-if="store.songs.length > 4" v-model="q" class="search-input" type="search" placeholder="Search songs..." />

      <div v-if="store.songs.length === 0" class="empty">
        <p>No songs yet. Tap <strong>+ Song</strong> to get started.</p>
      </div>

      <ul v-else class="song-list">
        <li v-for="song in filtered" :key="song.id" class="song-card">
          <div class="song-info">
            <span class="song-title">{{ song.title }}</span>
            <span class="song-artist">{{ song.artist }}</span>
          </div>
          <div class="song-actions">
            <RouterLink :to="`/song/${song.id}/play`" class="btn btn-play">▶ Play</RouterLink>
            <RouterLink :to="`/song/${song.id}/edit`" class="btn btn-edit">✏️</RouterLink>
            <button class="btn btn-delete" @click="confirmDelete(song)">🗑️</button>
          </div>
        </li>
      </ul>
    </div>

    <!-- Export / Import -->
    <div class="io-row">
      <button class="btn-io" @click="exportSongs">⬇ Export songs</button>
      <label class="btn-io">
        ⬆ Import songs
        <input type="file" accept=".json" style="display:none" @change="importSongs" />
      </label>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useSongsStore } from '../stores/songs.js'
import { useSetlistsStore } from '../stores/setlists.js'

const store = useSongsStore()
const setlistsStore = useSetlistsStore()

onMounted(() => setlistsStore.loadSetlists())

const q = ref('')
const filtered = computed(() => {
  const s = q.value.toLowerCase().trim()
  if (!s) return store.songs
  return store.songs.filter(song =>
    song.title?.toLowerCase().includes(s) || song.artist?.toLowerCase().includes(s)
  )
})

async function confirmDelete(song) {
  if (confirm(`Delete "${song.title}"?`)) {
    await store.deleteSong(song.id)
  }
}

function exportSongs() {
  const blob = new Blob([JSON.stringify(store.songs, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'guitar-prompter-songs.json'
  a.click()
  URL.revokeObjectURL(a.href)
}

async function importSongs(e) {
  const file = e.target.files[0]
  if (!file) return
  try {
    const text = await file.text()
    const songs = JSON.parse(text)
    if (!Array.isArray(songs)) throw new Error()
    let added = 0
    for (const song of songs) {
      const exists = store.songs.some(
        s => s.title?.toLowerCase() === song.title?.toLowerCase() &&
             s.artist?.toLowerCase() === song.artist?.toLowerCase()
      )
      if (!exists) { await store.addSong(song); added++ }
    }
    alert(`Imported ${added} song${added !== 1 ? 's' : ''} (${songs.length - added} duplicates skipped)`)
  } catch {
    alert('Invalid file — expected a JSON array of songs')
  }
  e.target.value = ''
}
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding: 1rem;
  gap: 1.25rem;
}

.home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
}
.home-header h1 { font-size: 1.4rem; color: var(--text); }

.header-actions { display: flex; gap: 0.5rem; }

.btn-add {
  background: var(--accent);
  color: #fff;
  padding: 0.6rem 1.1rem;
  border-radius: var(--radius);
  font-weight: 600;
  font-size: 0.95rem;
}
.btn-setlist {
  background: var(--accent2);
  color: var(--text);
}

.section { display: flex; flex-direction: column; gap: 0.6rem; }

.section-title {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.8;
  padding: 1.5rem 0;
}

/* Setlists */
.setlist-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.setlist-card {
  background: var(--bg-card);
  border-radius: var(--radius);
  padding: 0.85rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-left: 3px solid var(--accent2);
}
.setlist-info { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
.setlist-name { font-size: 1rem; font-weight: 600; }
.setlist-count { font-size: 0.8rem; color: var(--text-muted); }

/* Songs */
.song-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.song-card {
  background: var(--bg-card);
  border-radius: var(--radius);
  padding: 0.9rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.song-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
  flex: 1;
}
.song-title {
  font-size: 1rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.song-artist { font-size: 0.82rem; color: var(--text-muted); }

.song-actions { display: flex; gap: 0.4rem; flex-shrink: 0; }

.btn {
  padding: 0.45rem 0.8rem;
  border-radius: var(--radius);
  border: none;
  font-size: 0.88rem;
  font-weight: 600;
  background: var(--accent2);
  color: var(--text);
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.btn-play { background: var(--accent); color: #fff; }
.btn-delete { background: #3a1a1a; }

.search-input {
  background: var(--bg-card);
  border: 1px solid #333;
  border-radius: var(--radius);
  color: var(--text);
  padding: 0.6rem 0.9rem;
  font-size: 1rem;
  width: 100%;
  outline: none;
}
.search-input:focus { border-color: var(--accent); }

/* Export / Import */
.io-row {
  display: flex;
  gap: 0.75rem;
  padding-bottom: 1rem;
}
.btn-io {
  flex: 1;
  background: var(--bg-card);
  border: 1px solid #333;
  border-radius: var(--radius);
  color: var(--text-muted);
  font-size: 0.85rem;
  padding: 0.6rem;
  text-align: center;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}
</style>
