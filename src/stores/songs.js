import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'guitar-prompter-songs'

function loadFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
  } catch {
    return []
  }
}

export const useSongsStore = defineStore('songs', () => {
  const songs = ref(loadFromStorage())

  watch(songs, (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
  }, { deep: true })

  function addSong(song) {
    songs.value.push({ ...song, id: Date.now().toString() })
  }

  function updateSong(id, data) {
    const idx = songs.value.findIndex(s => s.id === id)
    if (idx !== -1) songs.value[idx] = { ...songs.value[idx], ...data }
  }

  function deleteSong(id) {
    songs.value = songs.value.filter(s => s.id !== id)
  }

  function getSong(id) {
    return songs.value.find(s => s.id === id)
  }

  return { songs, addSong, updateSong, deleteSong, getSong }
})
