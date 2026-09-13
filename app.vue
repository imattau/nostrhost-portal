<script setup lang="ts">
const head = useLocaleHead({
  addDirAttribute: true,
  addSeoAttributes: true,
})

const settings = await useSettings()

useHead({
  titleTemplate: (titleChunk) => {
    const baseTitle = settings.value.portal_title
    return titleChunk ? `${titleChunk} - ${baseTitle}` : baseTitle
  },
})
</script>

<template>
  <NuxtLayout>
    <Html :lang="head.htmlAttrs?.lang" :dir="head.htmlAttrs?.dir" />

    <NuxtPage />
  </NuxtLayout>
</template>

<style>
:root {
  color-scheme: light;
  --portal-background: 248 247 251;
  --portal-surface: 255 255 255;
  --portal-elevated: 245 243 250;
  --portal-input: 255 255 255;
  --portal-border: 225 221 235;
  --portal-foreground: 35 31 48;
  --portal-muted: 104 98 119;
}

.dark {
  color-scheme: dark;
  --portal-background: 18 18 34;
  --portal-surface: 22 22 43;
  --portal-elevated: 30 30 55;
  --portal-input: 9 9 15;
  --portal-border: 42 42 71;
  --portal-foreground: 241 245 249;
  --portal-muted: 148 163 184;
}

body {
  font-family: 'Geist', sans-serif;
  @apply bg-portal-background text-portal-foreground antialiased;
}

#__nuxt {
  @apply min-h-screen flex;
}
</style>
