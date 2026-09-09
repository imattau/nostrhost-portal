<script setup lang="ts">
import { cva } from 'class-variance-authority'

const props = withDefaults(
  defineProps<{
    message?: string
    variant?: 'info' | 'success' | 'warning' | 'error'
    icon?: string
    assertive?: boolean
  }>(),
  {
    message: '',
    variant: 'info',
    icon: undefined,
    assertive: false,
  },
)

const alertVariants = cva(
  'flex items-center gap-3 rounded-md border p-4 text-sm',
  {
    variants: {
      variant: {
        info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100',
        success:
          'border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100',
        warning:
          'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100',
        error:
          'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100',
      },
    },
  },
)
</script>

<template>
  <div
    :aria-live="assertive ? 'assertive' : 'polite'"
    aria-atomic="true"
    :class="cn(alertVariants({ variant }))"
  >
    <YIcon v-if="icon" :name="icon" size="2em" aria-hidden="true" />
    <slot name="default">
      {{ message }}
    </slot>
  </div>
</template>
