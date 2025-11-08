<template>
  <div class="app-shell">
    <header class="app-header">
      <h1>Collections Intelligence Dashboard</h1>
      <nav>
        <RouterLink to="/">Overview</RouterLink>
      </nav>
    </header>
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: #0f172a;
  color: #f8fafc;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 2rem;
  background: rgba(15, 23, 42, 0.9);
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  position: sticky;
  top: 0;
  z-index: 10;
}

.app-header h1 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.app-header nav {
  display: flex;
  gap: 1rem;
}

.app-header a {
  color: inherit;
  text-decoration: none;
  font-weight: 500;
}

.app-header a.router-link-active {
  color: #38bdf8;
}

.app-main {
  flex: 1;
  padding: 2rem;
}
</style>
