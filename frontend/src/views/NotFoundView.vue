<template>
  <div class="not-found panel">
    <h1>404</h1>
    <p>The page you are looking for could not be found.</p>
    <RouterLink to="/">Return to dashboard</RouterLink>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.not-found {
  text-align: center;
  padding: 3rem;
}

.not-found h1 {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.not-found a {
  display: inline-block;
  margin-top: 1rem;
  color: #38bdf8;
}
</style>
