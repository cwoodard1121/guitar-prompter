import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCommunityStore = defineStore('community', () => {
  const songs = ref([])
  const total = ref(0)
  const page = ref(1)
  const loading = ref(false)
  const error = ref(null)

  async function load(q = '', p = 1) {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams({ page: p })
      if (q) params.set('q', q)
      const res = await fetch(`/api/community?${params}`)
      if (!res.ok) throw new Error('Failed to load community songs')
      const data = await res.json()
      if (p === 1) songs.value = data.songs
      else songs.value = [...songs.value, ...data.songs]
      total.value = data.total
      page.value = p
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function toggleLike(id) {
    const res = await fetch(`/api/community/${id}/like`, { method: 'POST' })
    if (!res.ok) return
    const data = await res.json()
    const song = songs.value.find(s => s.id === id)
    if (song) {
      song.liked = data.liked
      song.likesCount = data.likesCount
    }
  }

  async function copyToLibrary(song) {
    const res = await fetch('/api/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: song.title,
        artist: song.artist,
        content: '',
        isPublic: false
      })
    })
    if (!res.ok) throw new Error('Failed to copy song')
    return res.json()
  }

  return { songs, total, page, loading, error, load, toggleLike, copyToLibrary }
})
