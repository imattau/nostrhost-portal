<script setup lang="ts">
definePageMeta({ layout: false, public: true })
const { t } = useI18n()
const settings = await useSettings()
const settingsTitle = computed(() =>
  settings.value.portal_title && !/nostrhost/i.test(settings.value.portal_title)
    ? settings.value.portal_title
    : 'NostrHost Service Portal',
)
useHead({
  title: t('login'),
  script: [
    { src: '/nostrhost/sso/nostr/nostr-connect-vendor.js', defer: true },
    { src: '/nostrhost/sso/nostr/nostr-connect-ui.js', defer: true },
    { src: '/nostrhost/sso/nostr/nostr-passkey-vendor.js', defer: true },
  ],
})
const isLoggedIn = useIsLoggedIn()
const redirectUrl = useRedirectUrl()
const queryMsg = useQueryMsg()
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
  // Build an absolute portalapi URL: the app's Nuxt baseURL is /nostrhost/sso,
  // so a relative $fetch would be double-prefixed (…/sso/nostrhost/portalapi/…).
  const api = `https://${window.location.host}/nostrhost/portalapi`
  const { challenge } = await $fetch<{ challenge: string }>(
    `${api}/nostr/challenge`,
    { credentials: 'include' },
  )
  const signed = await signer.signEvent({
    kind: 22242,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['challenge', challenge],
      ['domain', window.location.host],
      ['action', 'nostrhost-login'],
    ],
    content: '',
  })
  await $fetch(`${api}/nostr/login`, {
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
  // The passkey vendor is injected as a deferred script, which may not
  // have executed by the time this component mounts. Poll briefly so a
  // stored passkey identity surfaces the "Use passkey" button even when
  // the script tag resolves late.
  let attempts = 0
  const check = () => {
    const passkey = (window as NostrWindow).NostrPasskey
    if (passkey) {
      passkeyAvailable.value = !!passkey.hasStoredPasskeyIdentity()
    } else if (attempts++ < 50) {
      setTimeout(check, 100)
    }
  }
  check()
})
</script>

<template>
  <main
    class="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-12"
  >
    <div
      aria-hidden="true"
      class="portal-login-glow pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
    />

    <section
      class="relative w-full max-w-[460px] rounded-3xl border border-portal-border bg-portal-surface p-6 shadow-2xl sm:p-12"
    >
      <div class="mb-8 flex flex-col items-center text-center">
        <div
          class="mb-4 grid size-12 place-items-center rounded-xl bg-brand-500/10 text-brand-500"
        >
          <YIcon name="shield-check" size="1.5rem" aria-hidden="true" />
        </div>
        <span
          class="mb-4 rounded-full border border-brand-500 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-brand-500"
        >
          Private cloud hub
        </span>
        <h1
          class="text-2xl font-extrabold tracking-tight text-portal-foreground"
        >
          {{ settingsTitle }}
        </h1>
        <p class="mt-2 max-w-xs text-sm leading-6 text-portal-muted">
          {{ t('nostr.intro') }}
        </p>
      </div>

      <BaseAlert
        v-if="redirectUrl"
        variant="warning"
        icon="alert-outline"
        :message="t('ssowat.protected')"
        class="mb-4"
        assertive
      />

      <BaseAlert
        v-if="queryMsg"
        variant="info"
        icon="login"
        :message="t(queryMsg)"
        class="mb-4"
        assertive
      />

      <BaseAlert
        v-if="error"
        variant="error"
        icon="alert-outline"
        :message="error"
        class="mb-5"
        assertive
      />

      <div class="space-y-3">
        <YButton
          icon="login"
          :text="t('nostr.sign_in')"
          block
          :disabled="busy"
          class="min-h-12"
          @click.prevent="signInWithNostr"
        />
        <YButton
          v-if="passkeyAvailable"
          icon="lock"
          text="Use passkey"
          block
          variant="secondary"
          :disabled="busy"
          @click.prevent="signInWithPasskey"
        />
      </div>

      <div class="my-6 flex items-center gap-3 text-xs text-portal-muted">
        <span class="h-px flex-1 bg-portal-border" />
        Or connect a remote signer
        <span class="h-px flex-1 bg-portal-border" />
      </div>

      <form class="space-y-3" @submit.prevent="signInWithBunker">
        <input
          id="nostr-bunker"
          aria-label="Remote signer address"
          v-model="bunker"
          class="w-full rounded-[10px] border border-portal-border bg-portal-input px-4 py-3 text-sm text-portal-foreground placeholder:text-portal-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          placeholder="bunker:// or NIP-05 signer"
          autocomplete="off"
          :disabled="busy"
        />
        <YButton
          type="submit"
          text="Connect remote signer"
          variant="secondary"
          block
          :disabled="busy || !bunker.trim()"
        />
      </form>
    </section>

    <p class="absolute bottom-5 px-5 text-center text-xs text-portal-muted">
      Sign in with a Nostr identity you control.
    </p>
  </main>
</template>

<style scoped>
.portal-login-glow {
  background: radial-gradient(ellipse, rgb(139 92 246 / 12%), transparent 68%);
  filter: blur(18px);
}
</style>
