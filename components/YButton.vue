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
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] px-4 py-2.5 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none',
  {
    variants: {
      variant: {
        primary: 'bg-portal-foreground text-portal-background hover:opacity-85',
        secondary:
          'border border-portal-border bg-transparent text-portal-foreground hover:bg-portal-elevated',
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
