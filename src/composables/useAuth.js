import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const user = ref(null)  // { id, email, displayName } or null
const loading = ref(true)

export function useAuth() {
  const router = useRouter()
  const isLoggedIn = computed(() => !!user.value)

  async function loadUser() {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        user.value = data.user
      } else {
        user.value = null
      }
    } catch {
      user.value = null
    } finally {
      loading.value = false
    }
  }

  async function login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    user.value = data.user
    return data.user
  }

  async function register(email, password) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Registration failed')
    user.value = data.user
    return data.user
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    router.push('/login')
  }

  return { user, isLoggedIn, loading, loadUser, login, register, logout }
}
