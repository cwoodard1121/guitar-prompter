import { defineStore } from 'pinia'
import { ref } from 'vue'
import router from '../router/index.js'
import { useAuth } from '../composables/useAuth.js'

const API_BASE = '/api/songs'

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, opts)
  if (res.status === 401) {
    const { user } = useAuth()
    user.value = null
    router.push('/login')
    throw new Error('Session expired. Please log in again.')
  }
  return res
}

async function fetchSongs() {
  try {
    const res = await apiFetch(API_BASE)
    if (!res.ok) throw new Error('Failed to fetch songs')
    return await res.json()
  } catch (e) {
    console.error('Failed to fetch songs from server:', e)
    // Fallback to empty array
    return []
  }
}

async function createSong(song) {
  try {
    const res = await apiFetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(song)
    })
    if (!res.ok) throw new Error('Failed to create song')
    return await res.json()
  } catch (e) {
    console.error('Failed to create song:', e)
    // Fallback: create locally with client-generated ID
    return { ...song, id: Date.now().toString() }
  }
}

async function updateSongServer(id, data) {
  try {
    const res = await apiFetch(`${API_BASE}?id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error('Failed to update song')
    return await res.json()
  } catch (e) {
    console.error('Failed to update song:', e)
    return null
  }
}

async function deleteSongServer(id) {
  try {
    const res = await apiFetch(`${API_BASE}?id=${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete song')
    return true
  } catch (e) {
    console.error('Failed to delete song:', e)
    return false
  }
}

export const useSongsStore = defineStore('songs', () => {
  const songs = ref([])
  const loading = ref(false)

  async function loadSongs() {
    loading.value = true
    try {
      songs.value = await fetchSongs()
    } finally {
      loading.value = false
    }
  }

  async function addSong(song) {
    const newSong = await createSong(song)
    songs.value.push(newSong)
    return newSong
  }

  async function updateSong(id, data) {
    const result = await updateSongServer(id, data)
    if (result) {
      const idx = songs.value.findIndex(s => s.id === id)
      if (idx !== -1) {
        songs.value[idx] = result
      }
    }
    return result
  }

  async function deleteSong(id) {
    const success = await deleteSongServer(id)
    if (success) {
      songs.value = songs.value.filter(s => s.id !== id)
    }
    return success
  }

  function getSong(id) {
    return songs.value.find(s => s.id === id)
  }

  return { songs, loading, loadSongs, addSong, updateSong, deleteSong, getSong }
})

