import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import SongEditView from '../views/SongEditView.vue'
import TeleprompterView from '../views/TeleprompterView.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/song/new', component: SongEditView },
    { path: '/song/:id/edit', component: SongEditView },
    { path: '/song/:id/play', component: TeleprompterView },
  ]
})
