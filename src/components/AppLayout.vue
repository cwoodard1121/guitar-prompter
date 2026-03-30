<template>
  <div class="app-shell">
    <nav class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-icon">
          <Guitar :size="18" />
        </div>
        <span class="brand-text">Guitar Portal</span>
      </div>

      <div class="nav-group">
        <RouterLink to="/" class="nav-link" :class="{ active: route.path === '/' }">
          <Home :size="17" />
          <span class="nav-label">Library</span>
        </RouterLink>
        <RouterLink to="/community" class="nav-link" :class="{ active: route.path === '/community' }">
          <Users :size="17" />
          <span class="nav-label">Community</span>
        </RouterLink>
      </div>

      <div class="nav-group nav-ctas">
        <RouterLink to="/song/new" class="nav-link nav-cta-song">
          <FilePlus :size="17" />
          <span class="nav-label">New Song</span>
        </RouterLink>
        <RouterLink to="/setlist/new" class="nav-link nav-cta-setlist">
          <ListPlus :size="17" />
          <span class="nav-label">New Setlist</span>
        </RouterLink>
      </div>

      <div class="nav-group nav-bottom">
        <RouterLink to="/settings" class="nav-link" :class="{ active: route.path === '/settings' }">
          <Settings :size="17" />
          <span class="nav-label">Settings</span>
        </RouterLink>
      </div>
    </nav>

    <main class="app-content">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { useRoute, RouterLink } from 'vue-router'
import { Guitar, Home, FilePlus, ListPlus, Settings, Users } from 'lucide-vue-next'

const route = useRoute()
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  min-height: 100dvh;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  display: flex;
  flex-direction: column;
  padding: 1.25rem 0.75rem;
  position: sticky;
  top: 0;
  align-self: flex-start;
  height: 100dvh;
  flex-shrink: 0;
  overflow-y: auto;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.4rem 0.5rem 1.1rem;
  margin-bottom: 0.4rem;
  border-bottom: 1px solid var(--sidebar-border);
}

.brand-icon {
  width: 2rem;
  height: 2rem;
  background: linear-gradient(135deg, var(--accent), #c0254a);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 2px 8px var(--accent-glow);
}

.brand-text {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text);
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.5rem 0;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 0.88rem;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
  border-left: 2px solid transparent;
}

.nav-link:hover {
  background: var(--nav-hover);
  color: var(--text);
}

.nav-link.active {
  background: var(--nav-active-bg);
  color: var(--text);
  border-left-color: var(--nav-active-border);
  font-weight: 600;
}

.nav-cta-song {
  background: rgba(232, 54, 93, 0.08);
  color: var(--accent);
  border: 1px solid rgba(232, 54, 93, 0.15);
  border-left-width: 1px;
}
.nav-cta-song:hover {
  background: rgba(232, 54, 93, 0.14);
  color: var(--accent);
}

.nav-cta-setlist {
  background: rgba(124, 111, 255, 0.08);
  color: var(--accent2-bright);
  border: 1px solid rgba(124, 111, 255, 0.18);
  border-left-width: 1px;
}
.nav-cta-setlist:hover {
  background: rgba(124, 111, 255, 0.14);
  color: var(--accent2-bright);
}

.nav-bottom {
  margin-top: auto;
  border-top: 1px solid var(--sidebar-border);
  padding-top: 0.75rem;
}

/* Mobile: fixed bottom bar */
@media (max-width: 640px) {
  .sidebar {
    width: 100%;
    min-height: auto;
    height: auto;
    flex-direction: row;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    top: auto;
    padding: 0.35rem 0.5rem;
    border-right: none;
    border-top: 1px solid var(--sidebar-border);
    z-index: 100;
    align-items: center;
    justify-content: space-around;
    overflow: visible;
  }

  .sidebar-brand {
    display: none;
  }

  .nav-group {
    flex-direction: row;
    padding: 0;
    gap: 0;
  }

  .nav-group.nav-ctas {
    gap: 0;
  }

  .nav-bottom {
    margin-top: 0;
    border-top: none;
    padding-top: 0;
  }

  .nav-link {
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.35rem 0.75rem;
    font-size: 0.65rem;
    border-left: none;
    border-bottom: 2px solid transparent;
    border-radius: var(--radius-xs);
  }

  .nav-link.active {
    border-left-color: transparent;
    border-bottom-color: var(--nav-active-border);
  }

  .nav-cta-song,
  .nav-cta-setlist {
    border: none;
    background: none;
  }

  .nav-cta-song { color: var(--accent); }
  .nav-cta-setlist { color: var(--accent2-bright); }
}
</style>
