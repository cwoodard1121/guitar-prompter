<template>
  <div class="settings-view">
    <header class="settings-header">
      <button class="btn-back" @click="router.back()">← Back</button>
      <h2>Settings</h2>
    </header>

    <div class="settings-body">

      <div class="settings-section">
        <div class="section-title">Beta</div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Experimental features</div>
            <div class="setting-desc">Enables beta features: AI fill (auto chord chart from web), lyric position sync (Whisper mic), and debug overlays on the play screen.</div>
          </div>
          <button
            class="toggle"
            :class="{ on: settings.experimentalFeatures }"
            @click="settings.experimentalFeatures = !settings.experimentalFeatures"
            :aria-pressed="settings.experimentalFeatures"
          >
            <span class="toggle-thumb"></span>
          </button>
        </div>
      </div>

      <div class="settings-section">
        <div class="section-title">About</div>
        <div class="about-row">
          <span class="about-label">Guitar Portal</span>
          <span class="about-value">v0.1.0</span>
        </div>
        <div class="about-row">
          <span class="about-label">Deployed on</span>
          <span class="about-value">Render (free tier)</span>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useSettings } from '../composables/useSettings.js'

const router = useRouter()
const { settings } = useSettings()
</script>

<style scoped>
.settings-view {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding: 1rem;
  gap: 1.5rem;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
}

.btn-back {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.95rem;
  padding: 0.4rem 0;
  font-weight: 500;
  transition: color 0.15s;
}
.btn-back:active { color: var(--text); }

.settings-header h2 { font-size: 1.1rem; font-weight: 600; }

.settings-body {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-title {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 700;
  color: var(--text-muted);
  padding-bottom: 0.45rem;
  border-bottom: 1px solid var(--border-subtle);
}

.setting-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 0.85rem 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
  min-width: 0;
}

.setting-label {
  font-size: 1rem;
  font-weight: 600;
}

.setting-desc {
  font-size: 0.8rem;
  color: var(--text-muted);
  line-height: 1.5;
}

/* Toggle switch */
.toggle {
  flex-shrink: 0;
  width: 2.8rem;
  height: 1.6rem;
  border-radius: 99px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.12);
  position: relative;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  margin-top: 0.1rem;
}
.toggle.on {
  background: var(--accent);
  border-color: var(--accent);
}
.toggle-thumb {
  position: absolute;
  top: 50%;
  left: 0.2rem;
  transform: translateY(-50%);
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  background: #fff;
  transition: left 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.toggle.on .toggle-thumb {
  left: calc(100% - 1.3rem);
}

/* About rows */
.about-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.65rem 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  font-size: 0.92rem;
}
.about-label { color: var(--text); }
.about-value { color: var(--text-muted); font-size: 0.85rem; }
</style>
