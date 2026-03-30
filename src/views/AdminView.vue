<template>
  <div class="admin-view">
    <h1 class="page-title">Admin</h1>

    <div class="tab-bar">
      <button class="tab-btn" :class="{ active: tab === 'songs' }" @click="tab = 'songs'">Songs</button>
      <button class="tab-btn" :class="{ active: tab === 'users' }" @click="tab = 'users'">Users</button>
    </div>

    <!-- Songs tab -->
    <div v-if="tab === 'songs'">
      <div class="toolbar">
        <input v-model="songSearch" class="search-input" placeholder="Search title, artist, owner…" />
        <span class="count-badge">{{ filteredSongs.length }} songs</span>
      </div>

      <div v-if="songsLoading" class="loading-msg">Loading…</div>
      <div v-else-if="songsError" class="error-msg">{{ songsError }}</div>
      <div v-else-if="filteredSongs.length === 0" class="empty-msg">No songs found.</div>

      <div v-else class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Artist</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Likes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="song in filteredSongs" :key="song.id">
              <td class="td-title">{{ song.title || '(untitled)' }}</td>
              <td class="td-muted">{{ song.artist || '—' }}</td>
              <td class="td-muted td-owner">{{ song.ownerEmail || 'global' }}</td>
              <td>
                <span v-if="song.isPublic" class="badge badge-public">Public</span>
                <span v-else class="badge badge-private">Private</span>
              </td>
              <td class="td-muted td-center">{{ song.likesCount }}</td>
              <td class="td-actions">
                <button
                  v-if="song.isPublic"
                  class="btn-action btn-unpublish"
                  @click="unpublish(song)"
                  :disabled="song._busy"
                >Unpublish</button>
                <button
                  class="btn-action btn-delete"
                  @click="deleteSong(song)"
                  :disabled="song._busy"
                >Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Users tab -->
    <div v-if="tab === 'users'">
      <div class="toolbar">
        <span class="count-badge">{{ users.length }} users</span>
      </div>

      <div v-if="usersLoading" class="loading-msg">Loading…</div>
      <div v-else-if="usersError" class="error-msg">{{ usersError }}</div>
      <div v-else-if="users.length === 0" class="empty-msg">No users yet.</div>

      <div v-else class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Display Name</th>
              <th>Songs</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td>{{ u.email }}</td>
              <td class="td-muted">{{ u.displayName || '—' }}</td>
              <td class="td-center td-muted">{{ u.songCount }}</td>
              <td class="td-muted">{{ formatDate(u.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'

const tab = ref('songs')

// ── Songs ────────────────────────────────────────────────────────────────────
const songs = ref([])
const songsLoading = ref(false)
const songsError = ref(null)
const songSearch = ref('')

const filteredSongs = computed(() => {
  const q = songSearch.value.toLowerCase()
  if (!q) return songs.value
  return songs.value.filter(s =>
    s.title.toLowerCase().includes(q) ||
    s.artist.toLowerCase().includes(q) ||
    (s.ownerEmail || '').toLowerCase().includes(q)
  )
})

async function loadSongs() {
  songsLoading.value = true
  songsError.value = null
  try {
    const res = await fetch('/api/admin/songs')
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load')
    songs.value = await res.json()
  } catch (e) {
    songsError.value = e.message
  } finally {
    songsLoading.value = false
  }
}

async function unpublish(song) {
  song._busy = true
  try {
    const res = await fetch(`/api/admin/songs/${song.id}/unpublish`, { method: 'PUT' })
    if (!res.ok) throw new Error((await res.json()).error)
    song.isPublic = false
    song.likesCount = 0
  } catch (e) {
    alert(e.message)
  } finally {
    song._busy = false
  }
}

async function deleteSong(song) {
  if (!confirm(`Delete "${song.title || 'this song'}"? This cannot be undone.`)) return
  song._busy = true
  try {
    const res = await fetch(`/api/admin/songs/${song.id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error((await res.json()).error)
    songs.value = songs.value.filter(s => s.id !== song.id)
  } catch (e) {
    alert(e.message)
    song._busy = false
  }
}

// ── Users ────────────────────────────────────────────────────────────────────
const users = ref([])
const usersLoading = ref(false)
const usersError = ref(null)

async function loadUsers() {
  usersLoading.value = true
  usersError.value = null
  try {
    const res = await fetch('/api/admin/users')
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load')
    users.value = await res.json()
  } catch (e) {
    usersError.value = e.message
  } finally {
    usersLoading.value = false
  }
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

watch(tab, t => {
  if (t === 'songs' && songs.value.length === 0) loadSongs()
  if (t === 'users' && users.value.length === 0) loadUsers()
})

onMounted(loadSongs)
</script>

<style scoped>
.admin-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.tab-bar {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 0;
}

.tab-btn {
  padding: 0.5rem 1.1rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  margin-bottom: -1px;
}
.tab-btn.active {
  color: var(--text);
  border-bottom-color: var(--accent);
  font-weight: 600;
}
.tab-btn:hover:not(.active) { color: var(--text); }

.toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.search-input {
  flex: 1;
  max-width: 320px;
  padding: 0.5rem 0.75rem;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: 0.85rem;
  outline: none;
}
.search-input:focus { border-color: var(--accent); }

.count-badge {
  font-size: 0.78rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.admin-table th {
  text-align: left;
  padding: 0.6rem 0.85rem;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-subtle);
  white-space: nowrap;
}

.admin-table td {
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
}

.admin-table tbody tr:last-child td { border-bottom: none; }
.admin-table tbody tr:hover td { background: var(--bg-card-hover, rgba(255,255,255,0.02)); }

.td-muted { color: var(--text-muted); }
.td-title { font-weight: 500; }
.td-owner { font-size: 0.8rem; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.td-center { text-align: center; }
.td-actions { display: flex; gap: 0.4rem; flex-wrap: nowrap; }

.badge {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 99px;
  font-size: 0.72rem;
  font-weight: 600;
}
.badge-public { background: rgba(74, 222, 128, 0.12); color: #4ade80; }
.badge-private { background: rgba(255,255,255,0.06); color: var(--text-muted); }

.btn-action {
  padding: 0.3rem 0.65rem;
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.btn-action:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-unpublish {
  background: rgba(255,255,255,0.06);
  border-color: var(--border-subtle);
  color: var(--text-muted);
}
.btn-unpublish:hover:not(:disabled) {
  background: rgba(255,255,255,0.1);
  color: var(--text);
}

.btn-delete {
  background: rgba(232, 54, 93, 0.1);
  border-color: rgba(232, 54, 93, 0.25);
  color: var(--accent);
}
.btn-delete:hover:not(:disabled) { background: rgba(232, 54, 93, 0.18); }

.loading-msg, .empty-msg {
  color: var(--text-muted);
  font-size: 0.9rem;
  padding: 2rem 0;
  text-align: center;
}
.error-msg {
  color: var(--accent);
  font-size: 0.85rem;
  padding: 1rem 0;
}
</style>
