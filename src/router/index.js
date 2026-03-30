import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import SongEditView from '../views/SongEditView.vue'
import TeleprompterView from '../views/TeleprompterView.vue'
import SetlistEditView from '../views/SetlistEditView.vue'
import SettingsView from '../views/SettingsView.vue'
import { useAuth } from '../composables/useAuth.js'

const publicRoutes = ['/login', '/register']

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/settings', component: SettingsView },
    { path: '/song/new', component: SongEditView },
    { path: '/song/:id/edit', component: SongEditView },
    { path: '/song/:id/play', component: TeleprompterView },
    { path: '/setlist/new', component: SetlistEditView },
    { path: '/setlist/:id/edit', component: SetlistEditView },
    { path: '/login', component: () => import('../views/LoginView.vue') },
    { path: '/register', component: () => import('../views/LoginView.vue'), props: { mode: 'register' } },
    { path: '/community', component: () => import('../views/CommunityView.vue') },
  ]
})

router.beforeEach((to) => {
  const { isLoggedIn, loading } = useAuth()
  // Skip guard during initial load (loading = true)
  if (loading.value) return true
  if (!publicRoutes.includes(to.path) && !isLoggedIn.value) {
    return '/login'
  }
  if (publicRoutes.includes(to.path) && isLoggedIn.value) {
    return '/'
  }
})

export default router
