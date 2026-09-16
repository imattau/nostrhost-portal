<script setup lang="ts">
let customLogo: Settings['portal_logo']
let svgUrl = ''

try {
  const settings = await useSettings()
  customLogo = settings.value.portal_logo
  if (customLogo?.is === 'svg' && customLogo.src) {
    // SVG images cannot execute embedded scripts when loaded from a Blob URL.
    svgUrl = URL.createObjectURL(
      new Blob([customLogo.src], { type: 'image/svg+xml' }),
    )
  }
} catch {
  // The branded fallback remains available when the portal API is offline.
}
</script>

<template>
  <img
    v-if="customLogo?.is === 'svg'"
    :src="svgUrl"
    alt=""
    aria-hidden="true"
  />
  <img
    v-else-if="customLogo?.is === 'img'"
    :src="customLogo.src"
    alt=""
    aria-hidden="true"
  />
  <span
    v-else
    class="grid size-10 place-items-center bg-portal-foreground font-mono text-xs font-bold tracking-tight text-portal-background"
    aria-hidden="true"
  >
    NH
  </span>
</template>

<style scoped>
img {
  max-width: 10rem;
  max-height: 4rem;
  object-fit: contain;
}
</style>
