<script setup lang="ts">
withDefaults(
  defineProps<{
    tag?: string
    text?: string
    srOnly?: boolean
  }>(),
  {
    tag: 'h1',
    text: undefined,
    srOnly: false,
  },
)
</script>

<template>
  <component
    :is="tag"
    id="main-target"
    tabindex="-1"
    class="block text-2xl font-bold tracking-tight sm:text-3xl"
    :class="{ 'sr-only focus:not-sr-only': srOnly }"
  >
    <slot name="default">
      {{ text }}
    </slot>
  </component>
</template>
