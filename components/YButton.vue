<script setup lang="ts">
import { cva } from 'class-variance-authority'
import { NuxtLink } from '#components'

withDefaults(
  defineProps<{
    type?: 'button' | 'submit' | 'reset'
    text?: string
    variant?: 'primary' | 'secondary' | 'success' | 'info' | 'error'
    icon?: string
    iconSize?: string
    iconOnly?: boolean
    iconClass?: string
    block?: boolean
  }>(),
  {
    type: 'button',
    text: undefined,
    variant: 'primary',
    icon: undefined,
    iconSize: '1.5em',
    iconClass: '',
    iconOnly: false,
    block: false,
  },
)

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-3 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-portal-surface',
  {
    variants: {
      variant: {
        primary: 'bg-brand-500 text-white hover:bg-brand-600',
        secondary:
          'border border-portal-border bg-portal-elevated text-portal-foreground hover:border-brand-500 hover:text-brand-500',
        success: 'bg-green-600 text-white hover:bg-green-700',
        info: 'bg-sky-600 text-white hover:bg-sky-700',
        error: 'bg-red-600 text-white hover:bg-red-700',
      },
      block: { true: 'flex w-full' },
    },
  },
)
</script>

<template>
  <component
    :is="$attrs.to ? NuxtLink : 'button'"
    :class="cn(buttonVariants({ variant, block }))"
    :type="$attrs.to ? null : type"
  >
    <slot name="default">
      <YIcon
        v-if="icon"
        :name="icon"
        :size="iconSize"
        :class="iconClass"
        aria-hidden="true"
      />
      <span :class="{ 'sr-only': iconOnly }">{{ text }}</span>
    </slot>
  </component>
</template>
