<template>
  <div class="home">
    <!-- Setlists -->
    <div v-if="setlistsStore.setlists.length > 0" class="section">
      <div class="section-title">Setlists</div>
      <ul class="setlist-list">
        <li v-for="setlist in setlistsStore.setlists" :key="setlist.id" class="setlist-card">
          <div class="setlist-info">
            <span class="setlist-name">{{ setlist.name }}</span>
            <span class="setlist-count"><span class="count-badge">{{ setlist.songIds?.length ?? 0 }}</span> songs</span>
          </div>
          <div class="song-actions">
            <RouterLink
              v-if="setlist.songIds?.length"
              :to="`/song/${setlist.songIds[0]}/play?setlist=${setlist.id}&idx=0`"
              class="btn btn-play"
            ><Play :size="13" /> Play</RouterLink>
            <RouterLink :to="`/setlist/${setlist.id}/edit`" class="btn btn-edit"><Pencil :size="13" /></RouterLink>
          </div>
        </li>
      </ul>
    </div>

    <!-- Songs -->
    <div class="section">
      <div class="section-title">Songs</div>
      <input v-if="store.songs.length > 4" v-model="q" class="search-input" type="search" placeholder="Search songs..." />

      <div v-if="store.songs.length === 0" class="empty">
        <p>No songs yet. Use <strong>New Song</strong> to get started.</p>
      </div>

      <ul v-else class="song-list">
        <li v-for="song in filtered" :key="song.id" class="song-card">
          <img
            v-if="song.youtubeId"
            :src="`https://img.youtube.com/vi/${song.youtubeId}/mqdefault.jpg`"
            class="song-thumb"
            loading="lazy"
            alt=""
          />
          <div class="song-info">
            <span class="song-title">{{ song.title }}</span>
            <span class="song-artist">{{ song.artist }}</span>
          </div>
          <div class="song-actions">
            <RouterLink :to="`/song/${song.id}/play`" class="btn btn-play"><Play :size="13" /></RouterLink>
            <RouterLink :to="`/song/${song.id}/edit`" class="btn btn-edit"><Pencil :size="13" /></RouterLink>
            <button class="btn btn-delete" @click="confirmDelete(song)"><Trash2 :size="13" /></button>
          </div>
        </li>
      </ul>
    </div>

    <!-- Export / Import -->
    <div class="io-row">
      <button class="btn-io" @click="exportSongs"><Download :size="15" /> Export songs</button>
      <label class="btn-io">
        <Upload :size="15" /> Import songs
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
import { Play, Pencil, Trash2, Download, Upload } from 'lucide-vue-next'

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
  a.download = 'guitar-portal-songs.json'
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
  gap: 1.5rem;
}

.section { display: flex; flex-direction: column; gap: 0.65rem; }

.section-title {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  font-weight: 700;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-subtle);
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.8;
  padding: 1.5rem 0;
  font-size: 0.95rem;
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
  padding: 0.9rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid var(--border-subtle);
  border-left: 3px solid var(--accent2-bright);
  box-shadow: var(--shadow-sm);
}
.setlist-info { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
.setlist-name { font-size: 1rem; font-weight: 600; }
.setlist-count { font-size: 0.78rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.3rem; }
.count-badge {
  background: rgba(124,111,255,0.18);
  color: var(--accent2-bright);
  font-size: 0.72rem;
  font-weight: 700;
  border-radius: 99px;
  padding: 0.1em 0.55em;
  line-height: 1.4;
}

/* Songs */
.song-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}
.song-card {
  background: var(--bg-card);
  border-radius: var(--radius);
  padding: 0.85rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-sm);
  transition: border-color 0.2s;
}
.song-card:active { transform: scale(0.99); opacity: 0.9; }
@media (hover: hover) {
  .song-card:hover { border-color: var(--border-mid); background: var(--bg-card-hover); }
}
.song-thumb {
  width: 64px;
  height: 36px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
  background: #0a0a1a;
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

.song-actions { display: flex; gap: 0.35rem; flex-shrink: 0; }

.btn {
  padding: 0.45rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-mid);
  font-size: 0.85rem;
  font-weight: 600;
  background: rgba(255,255,255,0.06);
  color: var(--text);
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.btn-play {
  background: var(--accent);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 2px 6px var(--accent-glow);
}
.btn-play:active { opacity: 0.85; }
.btn-delete {
  background: rgba(232,54,93,0.08);
  border-color: rgba(232,54,93,0.18);
  color: rgba(232,54,93,0.6);
}
.btn:active { opacity: 0.75; transform: scale(0.95); }

.search-input {
  background: var(--bg-card);
  border: 1px solid var(--border-mid);
  border-radius: var(--radius);
  color: var(--text);
  padding: 0.65rem 0.95rem;
  font-size: 1rem;
  width: 100%;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}

/* Export / Import */
.io-row {
  display: flex;
  gap: 0.75rem;
  padding-bottom: 1rem;
}
.btn-io {
  flex: 1;
  background: var(--bg-card);
  border: 1px solid var(--border-mid);
  border-radius: var(--radius);
  color: var(--text-muted);
  font-size: 0.83rem;
  font-weight: 500;
  padding: 0.65rem;
  text-align: center;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  transition: border-color 0.2s, color 0.2s;
}
.btn-io:active { opacity: 0.7; }
</style>
