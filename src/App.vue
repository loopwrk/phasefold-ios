<template>
  <div class="app">
    <div class="view-container">
      <router-view />
    </div>
  </div>
</template>

<!-- Global resets -->
<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
}

body {
  font-family:
    "Figtree Variable", -apple-system, BlinkMacSystemFont, "SF Pro Text",
    "Helvetica Neue", sans-serif;
  background: #f5f5f7;
  color: #1d1d1f;
  -webkit-font-smoothing: antialiased;
  -webkit-text-size-adjust: 100%;
}

.app {
  height: 100%;
  display: flex;
  flex-direction: column;
  max-width: 480px;
  margin: 0 auto;
  background: var(--cs-bg);
}

.app>.view-container {
  flex: 1;
  min-height: 0;
}
</style>
