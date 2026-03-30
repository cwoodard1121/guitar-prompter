<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-brand">
        <div class="brand-icon-wrap">
          <Guitar :size="20" />
        </div>
        <span class="brand-name">Guitar Portal</span>
      </div>

      <div class="auth-tabs">
        <button
          class="auth-tab"
          :class="{ active: activeTab === 'login' }"
          @click="switchTab('login')"
          type="button"
        >
          Log in
        </button>
        <button
          class="auth-tab"
          :class="{ active: activeTab === 'register' }"
          @click="switchTab('register')"
          type="button"
        >
          Register
        </button>
      </div>

      <form class="auth-form" @submit.prevent="submit" novalidate>
        <div v-if="error" class="auth-error" role="alert">
          {{ error }}
          <button class="error-dismiss" type="button" @click="error = ''" aria-label="Dismiss error">
            <X :size="14" />
          </button>
        </div>

        <div class="form-field">
          <label for="auth-email" class="field-label">Email</label>
          <input
            id="auth-email"
            v-model="email"
            type="email"
            class="field-input"
            placeholder="you@example.com"
            autocomplete="email"
            :disabled="loading"
            @input="error = ''"
            required
          />
        </div>

        <div class="form-field">
          <label for="auth-password" class="field-label">Password</label>
          <input
            id="auth-password"
            v-model="password"
            type="password"
            class="field-input"
            placeholder="••••••••"
            :autocomplete="activeTab === 'login' ? 'current-password' : 'new-password'"
            :disabled="loading"
            @input="error = ''"
            required
          />
        </div>

        <button
          type="submit"
          class="btn-submit"
          :disabled="loading || !email || !password"
        >
          <span v-if="loading" class="spinner" aria-hidden="true"></span>
          <span>{{ activeTab === 'login' ? 'Log in' : 'Create account' }}</span>
        </button>
      </form>

      <p class="auth-switch">
        <template v-if="activeTab === 'login'">
          Don't have an account?
          <button class="switch-link" type="button" @click="switchTab('register')">Register</button>
        </template>
        <template v-else>
          Already have an account?
          <button class="switch-link" type="button" @click="switchTab('login')">Log in</button>
        </template>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Guitar, X } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth.js'

const props = defineProps({ mode: { type: String, default: 'login' } })
const router = useRouter()
const { login, register } = useAuth()

const activeTab = ref(props.mode)
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

function switchTab(tab) {
  activeTab.value = tab
  error.value = ''
}

async function submit() {
  error.value = ''
  loading.value = true
  try {
    if (activeTab.value === 'login') {
      await login(email.value.trim(), password.value)
    } else {
      await register(email.value.trim(), password.value)
    }
    router.push('/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  padding: 1.5rem;
}

.auth-card {
  width: 100%;
  max-width: 420px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 2rem 2rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Brand */
.auth-brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  justify-content: center;
}

.brand-icon-wrap {
  width: 2.25rem;
  height: 2.25rem;
  background: linear-gradient(135deg, var(--accent), #c0254a);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 2px 10px rgba(232, 54, 93, 0.35);
}

.brand-name {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text);
}

/* Tabs */
.auth-tabs {
  display: flex;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  padding: 0.25rem;
  gap: 0.25rem;
}

.auth-tab {
  flex: 1;
  padding: 0.5rem;
  border-radius: calc(var(--radius) - 2px);
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.auth-tab:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.05);
}

.auth-tab.active {
  background: var(--bg);
  color: var(--text);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}

/* Form */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.auth-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  background: rgba(232, 54, 93, 0.12);
  border: 1px solid rgba(232, 54, 93, 0.3);
  border-radius: var(--radius-sm);
  color: #ff6b8a;
  font-size: 0.85rem;
  padding: 0.6rem 0.75rem;
  line-height: 1.4;
}

.error-dismiss {
  background: none;
  border: none;
  color: #ff6b8a;
  cursor: pointer;
  padding: 0.1rem;
  flex-shrink: 0;
  opacity: 0.7;
  display: flex;
  align-items: center;
}

.error-dismiss:hover {
  opacity: 1;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field-label {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.01em;
}

.field-input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: 0.95rem;
  font-family: var(--font-sans);
  padding: 0.65rem 0.85rem;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}

.field-input::placeholder {
  color: var(--text-muted);
  opacity: 0.5;
}

.field-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(232, 54, 93, 0.15);
}

.field-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.95rem;
  font-weight: 600;
  font-family: var(--font-sans);
  padding: 0.7rem 1rem;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
  margin-top: 0.25rem;
}

.btn-submit:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-submit:active:not(:disabled) {
  transform: scale(0.98);
}

.btn-submit:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Spinner */
.spinner {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.65s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Footer link */
.auth-switch {
  text-align: center;
  font-size: 0.83rem;
  color: var(--text-muted);
  margin: 0;
}

.switch-link {
  background: none;
  border: none;
  color: var(--accent);
  font-size: inherit;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.switch-link:hover {
  opacity: 0.8;
}
</style>
