<template>
  <div class="chord-chart" v-if="displayChords.length > 0">
    <div class="chord-chart-header">
      <h3>Chord Diagrams</h3>
      <div class="chord-chart-controls">
        <button
          class="capo-toggle"
          :class="{ active: capoFret === 0 }"
          @click="capoFret = 0"
        >
          No Capo
        </button>
        <button
          class="capo-toggle"
          :class="{ active: capoFret === 1 }"
          @click="capoFret = capoFret === 1 ? 0 : 1"
        >
          Capo 1
        </button>
        <button
          class="capo-toggle"
          :class="{ active: capoFret === 2 }"
          @click="capoFret = capoFret === 2 ? 0 : 2"
        >
          Capo 2
        </button>
        <button
          class="capo-toggle"
          :class="{ active: capoFret === 3 }"
          @click="capoFret = capoFret === 3 ? 0 : 3"
        >
          Capo 3
        </button>
        <button
          class="capo-toggle"
          :class="{ active: capoFret === 4 }"
          @click="capoFret = capoFret === 4 ? 0 : 4"
        >
          Capo 4
        </button>
      </div>
    </div>
    <div class="chord-grid">
      <div v-for="chord in displayChords" :key="chord.displayName" class="chord-item">
        <div class="chord-diagram-wrap">
          <ChordDiagram
            v-if="chord.data"
            :name="chord.shapeName"
            :chord="chord.data"
            :tuning="['E', 'A', 'D', 'G', 'B', 'E']"
          />
          <div v-else class="chord-unknown">
            <div class="chord-unknown-box">?</div>
            <div class="chord-name">{{ chord.shapeName }}</div>
          </div>
          <div v-if="capoFret > 0" class="chord-sounds-as">
            sounds as {{ chord.displayName }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import ChordDiagram from './ChordDiagram.vue'
import { extractChordNames, getChord, transposeChord } from '../data/chords.js'

const props = defineProps({
  content: { type: String, default: '' }
})

const capoFret = ref(0)

// Original chord names from the content
const originalChordNames = computed(() => extractChordNames(props.content))

// When capo is on: show the shape you finger (chord transposed DOWN)
// The "sounds as" label shows the original chord name
const displayChords = computed(() => {
  return originalChordNames.value.map(name => {
    let shapeName
    if (capoFret.value > 0) {
      shapeName = transposeChord(name, -capoFret.value)
    } else {
      shapeName = name
    }
    return {
      displayName: name,
      shapeName,
      data: getChord(shapeName)
    }
  })
})
</script>

<style scoped>
.chord-chart {
  background: var(--bg-card);
  border-radius: var(--radius);
  padding: 1rem;
}

.chord-chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.chord-chart-header h3 {
  font-size: 0.95rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.chord-chart-controls {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.capo-toggle {
  background: var(--bg);
  color: var(--text-muted);
  border: 1px solid #333;
  border-radius: var(--radius);
  padding: 0.35rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.capo-toggle.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.chord-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: flex-start;
}

.chord-item {
  flex: 0 0 auto;
}

.chord-diagram-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.chord-sounds-as {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: -0.1rem;
}

.chord-unknown {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.chord-unknown-box {
  width: 100px;
  height: 130px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed #444;
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 2rem;
}

.chord-unknown .chord-name {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-muted);
}
</style>
