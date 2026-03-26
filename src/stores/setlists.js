import { defineStore } from 'pinia'
import { ref } from 'vue'

const API_BASE = '/api/setlists'

export const useSetlistsStore = defineStore('setlists', () => {
  const setlists = ref([])
  const loading = ref(false)

  async function loadSetlists() {
    loading.value = true
    try {
      const res = await fetch(API_BASE)
      if (!res.ok) throw new Error()
      setlists.value = await res.json()
    } catch {
      setlists.value = []
    } finally {
      loading.value = false
    }
  }

  async function addSetlist(setlist) {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(setlist)
    })
    if (!res.ok) throw new Error('Failed to create setlist')
    const created = await res.json()
    setlists.value.push(created)
    return created
  }

  async function updateSetlist(id, data) {
    const res = await fetch(`${API_BASE}?id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error('Failed to update setlist')
    const updated = await res.json()
    const idx = setlists.value.findIndex(s => s.id === id)
    if (idx !== -1) setlists.value[idx] = updated
    return updated
  }

  async function deleteSetlist(id) {
    const res = await fetch(`${API_BASE}?id=${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete setlist')
    setlists.value = setlists.value.filter(s => s.id !== id)
  }

  function getSetlist(id) {
    return setlists.value.find(s => s.id === id)
  }

  return { setlists, loading, loadSetlists, addSetlist, updateSetlist, deleteSetlist, getSetlist }
})
