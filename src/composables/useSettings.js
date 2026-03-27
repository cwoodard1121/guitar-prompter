import { ref, watch } from 'vue'

const DEFAULTS = {
  devMode: false,
}

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('gp-settings') || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

// Singleton — shared across all composable calls
const settings = ref(load())

watch(settings, (val) => {
  localStorage.setItem('gp-settings', JSON.stringify(val))
}, { deep: true })

export function useSettings() {
  return { settings }
}
