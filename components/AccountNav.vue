<script setup lang="ts">
const items = [
  { to: '/account/profile', label: 'Profile' },
  { to: '/account/identity', label: 'Nostr identity' },
  { to: '/account/preferences', label: 'Preferences' },
]
</script>

<template>
  <nav
    class="mb-7 flex gap-5 overflow-x-auto border-b border-portal-border"
    aria-label="Account sections"
  >
    <NuxtLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="border-b-2 border-transparent pb-2 text-sm text-portal-muted no-underline"
      active-class="!border-portal-signature !font-bold !text-portal-foreground"
    >
      {{ item.label }}
    </NuxtLink>
  </nav>
</template>
