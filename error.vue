<script setup lang="ts">
import type { H3Error } from 'h3'

const head = useLocaleHead({
  addDirAttribute: true,
  addSeoAttributes: true,
})

const props = defineProps<{
  error: H3Error
}>()

const { t } = useI18n()
const statusMessage = computed(
  () => props.error.statusMessage || props.error.message,
)

useHead({ title: `${props.error.statusCode} · NostrHost` })
</script>

<template>
  <main
    class="mx-auto flex min-h-screen w-full max-w-5xl items-center px-5 py-10 sm:px-8"
  >
    <Html :lang="head.htmlAttrs?.lang" :dir="head.htmlAttrs?.dir" />
    <div
      class="grid w-full gap-10 border-t-4 border-portal-signature pt-6 md:grid-cols-[220px_1fr] md:gap-16"
    >
      <div>
        <CustomLogo />
        <p class="mt-4 text-sm font-semibold">NostrHost</p>
      </div>
      <div class="border-t border-portal-border pt-6">
        <p
          class="font-mono text-sm font-semibold uppercase tracking-[0.16em] text-portal-signature"
        >
          {{ error.statusCode }}
        </p>
        <h1 class="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          {{ statusMessage }}
        </h1>
        <YButton class="mt-6" :text="t('back_to_apps')" to="/" />
      </div>
    </div>
  </main>
</template>
