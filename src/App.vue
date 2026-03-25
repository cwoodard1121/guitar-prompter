<template>
  <RouterView />
</template>

<script setup>
import { RouterView } from 'vue-router'
import { onMounted } from 'vue'
import { useSongsStore } from './stores/songs.js'

const store = useSongsStore()

onMounted(() => {
  store.loadSongs()
})
</script>
