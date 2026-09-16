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
  --portal-background: 242 239 231;
  --portal-surface: 251 250 246;
  --portal-elevated: 235 232 223;
  --portal-input: 255 254 250;
  --portal-border: 201 198 188;
  --portal-foreground: 31 32 28;
  --portal-muted: 91 91 83;
  --portal-selection: 232 224 247;
  --portal-signature: 103 70 144;
  --portal-focus: 90 57 130;
}

.dark {
  color-scheme: dark;
  --portal-background: 23 24 20;
  --portal-surface: 29 31 26;
  --portal-elevated: 37 39 33;
  --portal-input: 19 20 17;
  --portal-border: 66 68 59;
  --portal-foreground: 239 237 228;
  --portal-muted: 174 174 161;
  --portal-selection: 54 44 65;
  --portal-signature: 190 159 224;
  --portal-focus: 210 180 242;
}

body {
  font-family: 'Geist', sans-serif;
  @apply bg-portal-background text-portal-foreground antialiased;
}

::selection {
  background: rgb(var(--portal-selection));
}

:focus-visible {
  outline: 2px solid rgb(var(--portal-focus)) !important;
  outline-offset: 3px !important;
}

code,
.font-mono {
  font-variant-ligatures: none;
}

#__nuxt {
  @apply min-h-screen flex;
}
</style>
