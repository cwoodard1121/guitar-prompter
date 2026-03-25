<template>
  <div class="chord-chart" v-if="chordNames.length > 0">
    <div class="chord-chart-header">
      <h3>Chord Diagrams</h3>
      <div class="chord-chart-controls">
        <button
          class="capo-toggle"
          :class="{ active: !useBarre }"
          @click="useBarre = false"
          title="Open chord shapes (capo)"
        >
          Capo
        </button>
        <button
          class="capo-toggle"
          :class="{ active: useBarre }"
          @click="useBarre = true"
          title="Barre chord shapes (no capo)"
        >
          No Capo
        </button>
        <select v-model="selectedTuning" class="tuning-select">
          <option v-for="(tuning, key) in TUNINGS" :key="key" :value="key">
            {{ tuning.name }} ({{ tuning.strings.join(' ') }})
          </option>
        </select>
      </div>
    </div>
    <div class="chord-grid">
      <div v-for="name in chordNames" :key="name" class="chord-item">
        <ChordDiagram
          v-if="getChord(name, useBarre)"
          :name="name"
          :chord="getChord(name, useBarre)"
          :tuning="currentTuning.strings"
        />
        <div v-else class="chord-unknown">
          <div class="chord-unknown-box">?</div>
          <div class="chord-name">{{ name }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import ChordDiagram from './ChordDiagram.vue'
import { extractChordNames, getChord, TUNINGS } from '../data/chords.js'

const props = defineProps({
  content: { type: String, default: '' }
})

const selectedTuning = ref('Standard')
const useBarre = ref(false)
const currentTuning = computed(() => TUNINGS[selectedTuning.value] || TUNINGS['Standard'])

const chordNames = computed(() => extractChordNames(props.content))
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
  gap: 0.4rem;
}

.capo-toggle {
  background: var(--bg);
  color: var(--text-muted);
  border: 1px solid #333;
  border-radius: var(--radius);
  padding: 0.35rem 0.7rem;
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

.tuning-select {
  background: var(--bg);
  color: var(--text);
  border: 1px solid #333;
  border-radius: var(--radius);
  padding: 0.35rem 0.6rem;
  font-size: 0.75rem;
  outline: none;
}

.tuning-select:focus {
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
