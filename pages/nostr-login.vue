<script setup lang="ts">
definePageMeta({
  layout: false,
  public: true,
})

const { t } = useI18n()

useHead({
  title: t('nostr.login'),
})

const isLoggedIn = useIsLoggedIn()
const redirectUrl = useRedirectUrl()

const error = ref<string | null>(null)
const busy = ref(false)

type NostrWindow = Window & {
  nostr?: {
    getPublicKey(): Promise<string>
    signEvent(event: Record<string, unknown>): Promise<Record<string, unknown>>
  }
}

async function signInWithNostr() {
  error.value = null

  const nostr = (window as NostrWindow).nostr
  if (!nostr || typeof nostr.getPublicKey !== 'function') {
    error.value = t('nostr.extension_missing')
    return
  }

  busy.value = true
  try {
    // 1. Obtain a fresh single-use challenge bound to this domain
    const { challenge } = await $fetch<{ challenge: string }>(
      '/yunohost/portalapi/nostr/challenge',
      { credentials: 'include' },
    )

    // 2. Sign a NIP-42-style challenge event (kind 22242) with the user's key
    const event = {
      kind: 22242,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['challenge', challenge],
        // Must match the server's `Host` header byte-for-byte (see
        // nostrhost_auth's verify_challenge_response, which does an exact
        // string compare) — that's `location.host` (host:port), not
        // `location.hostname` (host only), or this fails on any instance
        // running on a non-default port.
        ['domain', window.location.host],
        ['action', 'yunohost-login'],
      ],
      content: '',
    }
    event.pubkey = await nostr.getPublicKey()
    const signed = await nostr.signEvent(event)

    // 3. The server verifies the signature, resolves the pubkey to an
    //    account and mints the yunohost.portal session cookie
    await $fetch('/yunohost/portalapi/nostr/login', {
      method: 'POST',
      credentials: 'include',
      body: { event: signed },
    })

    isLoggedIn.value = true
    if (redirectUrl.value) {
      await navigateTo(atob(redirectUrl.value), { external: true })
    }
    await navigateTo('/')
  } catch (e: any) {
    error.value = e?.data ?? t('nostr.login_failed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="w-50 m-auto max-w-[300px]">
    <CustomLogo class="flex-none mx-auto w-1/2 mb-10" />

    <BaseAlert
      v-if="error"
      variant="error"
      icon="alert-outline"
      :message="error"
      class="mb-4"
      assertive
    />

    <p class="mb-4 text-center text-slate-600 dark:text-slate-400">
      {{ t('nostr.intro') }}
    </p>

    <YButton
      icon="login"
      :text="t('nostr.sign_in')"
      block
      :disabled="busy"
      @click.prevent="signInWithNostr"
    />

    <p class="mt-4 text-center">
      <NuxtLink class="link" to="/login">{{ t('nostr.back_to_login') }}</NuxtLink>
    </p>
  </main>
</template>