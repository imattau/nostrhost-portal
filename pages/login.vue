<script setup lang="ts">
import { nip19 } from 'nostr-tools'
import { hexToBytes } from 'nostr-tools/utils'
import {
  hasStoredPasskeyIdentity,
  unlockPasskeyIdentity,
  buildPasskeySignerShim,
  importPasskeyIdentityFromNsec,
} from 'nostr-passkey'
import {
  connectNip07Signer,
  signNip98Challenge,
  useNostrConnectScripts,
  NostrExtensionMissingError,
  type NostrSigner,
  type NostrWindow,
} from '@/composables/nostrSigner'
import { useAsyncAction } from '@/composables/asyncAction'

definePageMeta({ layout: false, public: true })
const { t } = useI18n()
const settings = await useSettings()
const settingsTitle = computed(() =>
  settings.value.portal_title && !/nostrhost/i.test(settings.value.portal_title)
    ? settings.value.portal_title
    : 'NostrHost Service Portal',
)
useHead({ title: t('login') })
useNostrConnectScripts()
const isLoggedIn = useIsLoggedIn()
const redirectUrl = useRedirectUrl()
const queryMsg = useQueryMsg()
const error = ref<string | null>(null)
const { busy, run } = useAsyncAction()
const clearError = () => {
  error.value = null
}
const reportLoginError = (e: any) => {
  error.value = e?.message ?? t('nostr.login_failed')
}
const bunker = ref('')
const nsec = ref('')
const createPasskey = ref(false)
const passkeyAvailable = ref(false)

async function signInWithSigner(signer: NostrSigner) {
  const api = useApiEndpoint()
  const signed = await signNip98Challenge(signer, {
    challengeUrl: `${api}/nostr/challenge`,
    action: 'nostrhost-login',
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
  let signer: NostrSigner
  try {
    signer = connectNip07Signer()
  } catch (e) {
    error.value =
      e instanceof NostrExtensionMissingError
        ? t('nostr.extension_missing')
        : t('nostr.login_failed')
    return
  }
  await run(() => signInWithSigner(signer), {
    clear: clearError,
    onError: reportLoginError,
  })
}

async function signInWithBunker() {
  const ui = (window as NostrWindow).NostrConnectUI
  if (!ui || !bunker.value.trim()) return
  await run(
    async () => {
      await signInWithSigner(await ui.connectViaBunkerUri(bunker.value.trim()))
    },
    { clear: clearError, onError: reportLoginError },
  )
}

async function signInWithPasskey() {
  await run(
    async () => {
      const identity = await unlockPasskeyIdentity()
      await signInWithSigner(buildPasskeySignerShim(identity.secretKey))
    },
    { clear: clearError, onError: reportLoginError },
  )
}

function decodeNsec(input: string): Uint8Array {
  const value = input.trim()
  if (/^[0-9a-fA-F]{64}$/.test(value)) return hexToBytes(value)
  try {
    const decoded = nip19.decode(value)
    if (decoded.type !== 'nsec') throw new Error()
    return decoded.data
  } catch {
    throw new Error(t('nostr.nsec_invalid'))
  }
}

async function signInWithNsec() {
  let secretKey: Uint8Array | null = null
  await run(
    async () => {
      // Validate locally before optionally handing the raw nsec to the
      // passkey enrollment flow below - it does its own parsing, but
      // failing fast here keeps the error message consistent between the
      // two paths.
      secretKey = decodeNsec(nsec.value)
      if (createPasskey.value) {
        const identity = await importPasskeyIdentityFromNsec(
          nsec.value.trim(),
          {
            rpName: 'NostrHost Identity',
            userName: 'nostr-identity',
            displayName: 'NostrHost Identity',
          },
        )
        secretKey.fill(0)
        secretKey = identity.secretKey
      }
      await signInWithSigner(buildPasskeySignerShim(secretKey))
      nsec.value = ''
      createPasskey.value = false
    },
    {
      clear: clearError,
      onError: reportLoginError,
      onFinally: () => secretKey?.fill(0),
    },
  )
}

onMounted(() => {
  // Single sign-in redirect target: the `r` query param (base64 of the URL
  // to return to) set by the admin console / forward_auth. Populate the
  // shared redirect state so a successful login returns the user to the
  // console instead of the portal home.
  const params = new URLSearchParams(window.location.search)
  const r = params.get('r')
  if (r) redirectUrl.value = r

  passkeyAvailable.value = hasStoredPasskeyIdentity()
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
      class="relative w-full max-w-[460px] rounded-3xl border border-portal-border bg-portal-surface p-6 shadow-2xl sm:p-8"
    >
      <div class="mb-6 flex flex-col items-center text-center">
        <div
          class="mb-4 grid size-12 place-items-center rounded-xl bg-brand-500/10 text-brand-500"
        >
          <YIcon name="shield-check" size="1.5rem" aria-hidden="true" />
        </div>
        <span
          class="mb-4 rounded-full border border-brand-500 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-brand-500"
        >
          {{ t('nostr.tagline') }}
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
          :text="t('nostr.use_passkey')"
          block
          variant="secondary"
          :disabled="busy"
          @click.prevent="signInWithPasskey"
        />
      </div>

      <div class="my-6 flex items-center gap-3 text-xs text-portal-muted">
        <span class="h-px flex-1 bg-portal-border" />
        {{ t('nostr.or_remote_signer') }}
        <span class="h-px flex-1 bg-portal-border" />
      </div>

      <form class="space-y-3" @submit.prevent="signInWithBunker">
        <input
          id="nostr-bunker"
          v-model="bunker"
          :aria-label="t('nostr.remote_signer_address')"
          class="w-full rounded-[10px] border border-portal-border bg-portal-input px-4 py-3 text-sm text-portal-foreground placeholder:text-portal-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          placeholder="bunker:// or NIP-05 signer"
          autocomplete="off"
          :disabled="busy"
        />
        <YButton
          type="submit"
          :text="t('nostr.connect_remote_signer')"
          variant="secondary"
          block
          :disabled="busy || !bunker.trim()"
        />
      </form>

      <details class="mt-6">
        <summary
          class="cursor-pointer select-none text-xs font-medium text-portal-muted"
        >
          {{ t('nostr.advanced') }}
        </summary>
        <div class="mt-3 space-y-3">
          <BaseAlert
            variant="warning"
            icon="alert-outline"
            :message="t('nostr.nsec_warning')"
          />
          <form class="space-y-3" @submit.prevent="signInWithNsec">
            <input
              id="nostr-nsec"
              v-model="nsec"
              :aria-label="t('nostr.private_key')"
              type="password"
              class="w-full rounded-[10px] border border-portal-border bg-portal-input px-4 py-3 text-sm text-portal-foreground placeholder:text-portal-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              :placeholder="t('nostr.nsec_placeholder')"
              autocomplete="off"
              spellcheck="false"
              :disabled="busy"
            />
            <label
              v-if="!passkeyAvailable"
              for="nsec-create-passkey"
              class="flex items-center gap-2 text-sm text-portal-muted"
            >
              <input
                id="nsec-create-passkey"
                v-model="createPasskey"
                class="accent-brand-500"
                type="checkbox"
                :disabled="busy"
              />
              {{ t('nostr.nsec_create_passkey') }}
            </label>
            <YButton
              type="submit"
              :text="t('nostr.nsec_sign_in')"
              variant="secondary"
              block
              :disabled="busy || !nsec.trim()"
            />
          </form>
        </div>
      </details>
    </section>

    <p class="absolute bottom-5 px-5 text-center text-xs text-portal-muted">
      {{ t('nostr.footer') }}
    </p>
  </main>
</template>

<style scoped>
.portal-login-glow {
  background: radial-gradient(ellipse, rgb(139 92 246 / 12%), transparent 68%);
  filter: blur(18px);
}
</style>
