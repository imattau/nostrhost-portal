<script setup lang="ts">
definePageMeta({ layout: false, public: true })
const { t } = useI18n()
useHead({
  title: t('nostr.login'),
  script: [
    { src: '/yunohost/sso/nostr/nostr-connect-vendor.js', defer: true },
    { src: '/yunohost/sso/nostr/nostr-connect-ui.js', defer: true },
    { src: '/yunohost/sso/nostr/nostr-passkey-vendor.js', defer: true },
  ],
})
const isLoggedIn = useIsLoggedIn()
const redirectUrl = useRedirectUrl()
const error = ref<string | null>(null)
const busy = ref(false)
const bunker = ref('')
const passkeyAvailable = ref(false)

type NostrSigner = {
  signEvent(event: Record<string, unknown>): Promise<Record<string, unknown>>
}
type NostrWindow = Window & {
  nostr?: {
    getPublicKey(): Promise<string>
    signEvent(event: Record<string, unknown>): Promise<Record<string, unknown>>
  }
  NostrConnectUI?: { connectViaBunkerUri(value: string): Promise<NostrSigner> }
  NostrPasskey?: {
    hasStoredPasskeyIdentity(): boolean
    unlockPasskeyIdentity(): Promise<{ secretKey: Uint8Array }>
    buildPasskeySignerShim(key: Uint8Array): NostrSigner
  }
}

async function signInWithSigner(signer: NostrSigner) {
  const { challenge } = await $fetch<{ challenge: string }>(
    '/yunohost/portalapi/nostr/challenge',
    { credentials: 'include' },
  )
  const signed = await signer.signEvent({
    kind: 22242,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['challenge', challenge],
      ['domain', window.location.host],
      ['action', 'yunohost-login'],
    ],
    content: '',
  })
  await $fetch('/yunohost/portalapi/nostr/login', {
    method: 'POST',
    credentials: 'include',
    body: { event: signed },
  })
  isLoggedIn.value = true
  if (redirectUrl.value)
    await navigateTo(atob(redirectUrl.value), { external: true })
  await navigateTo('/')
}

async function signInWithNostr() {
  error.value = null
  const nostr = (window as NostrWindow).nostr
  if (!nostr) {
    error.value = t('nostr.extension_missing')
    return
  }
  busy.value = true
  try {
    await signInWithSigner({
      signEvent: async (event) => {
        event.pubkey = await nostr.getPublicKey()
        return nostr.signEvent(event)
      },
    })
  } catch (e: any) {
    error.value = e?.data ?? t('nostr.login_failed')
  } finally {
    busy.value = false
  }
}

async function signInWithBunker() {
  const ui = (window as NostrWindow).NostrConnectUI
  if (!ui || !bunker.value.trim()) return
  busy.value = true
  error.value = null
  try {
    await signInWithSigner(await ui.connectViaBunkerUri(bunker.value.trim()))
  } catch (e: any) {
    error.value = e?.message ?? t('nostr.login_failed')
  } finally {
    busy.value = false
  }
}

async function signInWithPasskey() {
  const passkey = (window as NostrWindow).NostrPasskey
  if (!passkey) return
  busy.value = true
  error.value = null
  try {
    const identity = await passkey.unlockPasskeyIdentity()
    await signInWithSigner(passkey.buildPasskeySignerShim(identity.secretKey))
  } catch (e: any) {
    error.value = e?.message ?? t('nostr.login_failed')
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  const passkey = (window as NostrWindow).NostrPasskey
  passkeyAvailable.value = !!passkey?.hasStoredPasskeyIdentity()
})
</script>

<template>
  <main class="w-50 m-auto max-w-[300px]">
    <CustomLogo class="mx-auto mb-10 flex-none w-1/2" />
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
    <YButton
      v-if="passkeyAvailable"
      class="mt-3"
      icon="lock"
      text="Use passkey"
      block
      :disabled="busy"
      @click.prevent="signInWithPasskey"
    />
    <div class="mt-5">
      <label class="sr-only" for="nostr-bunker">Remote signer</label>
      <input
        id="nostr-bunker"
        v-model="bunker"
        class="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
        placeholder="bunker:// or NIP-05 signer"
        autocomplete="off"
      />
      <YButton
        class="mt-2"
        text="Use remote signer"
        block
        :disabled="busy || !bunker.trim()"
        @click.prevent="signInWithBunker"
      />
    </div>
    <p class="mt-4 text-center">
      <NuxtLink class="link" to="/login">{{
        t('nostr.back_to_login')
      }}</NuxtLink>
    </p>
  </main>
</template>
