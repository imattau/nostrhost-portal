<script setup lang="ts">
definePageMeta({
  public: false,
})

const { t } = useI18n()

useHead({
  title: t('nostr_account.title'),
  script: [
    { src: '/nostrhost/sso/nostr/nostr-connect-vendor.js', defer: true },
    { src: '/nostrhost/sso/nostr/nostr-connect-ui.js', defer: true },
    { src: '/nostrhost/sso/nostr/nostr-passkey-vendor.js', defer: true },
  ],
})

const api = () => `https://${window.location.host}/nostrhost/portalapi`

type NostrSigner = {
  signEvent(event: Record<string, unknown>): Promise<Record<string, unknown>>
  close?(): Promise<void>
  destroy?(): void
}
type NostrWindow = Window & {
  nostr?: {
    getPublicKey(): Promise<string>
    signEvent(event: Record<string, unknown>): Promise<Record<string, unknown>>
  }
  NostrConnectUI?: {
    hasSaved(): boolean
    getSavedInfo(): { relays: string[]; remoteNpub: string } | null
    reconnectSaved(): Promise<NostrSigner | null>
    connectViaBunkerUri(value: string): Promise<NostrSigner>
    connectViaQr(
      onUriReady: (uri: string, dataUrl: string) => void,
      signal: AbortSignal,
    ): Promise<NostrSigner>
    clearSaved(): void
    clearLocalKey(): void
    clearAllSaved(): void
    hasLocalKey(): boolean
    generateLocalKeypair(): {
      secretKeyHex: string
      pubkeyHex: string
      nsec: string
      npub: string
    }
    createLocalSigner(secretKeyHex: string): NostrSigner
    saveLocalKey(secretKeyHex: string): void
  }
  NostrPasskey?: {
    hasStoredPasskeyIdentity(): boolean
    unlockPasskeyIdentity(): Promise<{ secretKey: Uint8Array }>
    buildPasskeySignerShim(key: Uint8Array): NostrSigner
    registerPasskeyIdentity(
      opts: Record<string, unknown>,
    ): Promise<{ secretKey: Uint8Array }>
    importPasskeyIdentityFromNsec(
      nsec: string,
      opts: Record<string, unknown>,
    ): Promise<{ secretKey: Uint8Array }>
    exportPasskeyIdentityAsNsec(): Promise<string>
    clearPasskeyIdentity(): void
  }
}

interface Identity {
  id: number
  pubkey: string
  npub: string
  label: string | null
  signer_type: string
  enabled: boolean
  created_at: number
  last_used: number | null
}

const username = ref<string | null>(null)
const allowLinking = ref(true)
const identities = ref<Identity[]>([])
const loading = ref(true)
const status = ref<{ text: string; kind: 'success' | 'error' } | null>(null)
const busy = ref(false)

const linkMode = ref<'add' | 'replace'>('replace')
const identityLabel = ref('')
const bunkerInput = ref('')
const qrOpen = ref(false)
const qrDataUrl = ref('')
const qrUri = ref('')

const generated = ref<{
  nsec: string
  npub: string
  secretKeyHex: string
} | null>(null)
const revealNsec = ref(false)
const rememberKey = ref(false)

const savedSigners = ref<{ relays: string[]; remoteNpub: string } | null>(null)
const hasLocalKey = ref(false)
const hasPasskey = ref(false)
const recoveryNsec = ref('')

const passkeyOpts = () => ({
  rpName: 'NostrHost Identity',
  userName: username.value || 'nostr-identity',
  displayName: 'NostrHost Identity',
  autoLockTimeout: 300000,
})

const signerLabel = (type: string) =>
  ({
    nip07: t('nostr_account.signer_nip07'),
    nip46: t('nostr_account.signer_nip46'),
    passkey: t('nostr_account.signer_passkey'),
  })[type] || t('nostr_account.signer_unknown')

function setStatus(text: string, kind: 'success' | 'error' = 'success') {
  status.value = { text, kind }
}

function refreshSaved() {
  const ui = (window as NostrWindow).NostrConnectUI
  const pk = (window as NostrWindow).NostrPasskey
  savedSigners.value = ui?.getSavedInfo() ?? null
  hasLocalKey.value = !!ui?.hasLocalKey()
  hasPasskey.value = !!pk?.hasStoredPasskeyIdentity()
  if (!hasPasskey.value) recoveryNsec.value = ''
}

async function load() {
  loading.value = true
  const resp = await $fetch<{
    username: string
    allow_identity_linking: boolean
    identities: Identity[]
  }>(`${api()}/nostr/identities`, { credentials: 'include' })
  username.value = resp.username
  allowLinking.value = resp.allow_identity_linking
  identities.value = resp.identities
  refreshSaved()
  loading.value = false
}

async function linkWithSigner(signer: NostrSigner, signerType: string) {
  const { challenge } = await $fetch<{ challenge: string }>(
    `${api()}/nostr/link/challenge`,
    { method: 'POST', credentials: 'include' },
  )
  const signed = await signer.signEvent({
    kind: 22242,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['challenge', challenge],
      ['domain', window.location.host],
      ['action', 'nostrhost-link'],
    ],
    content: '',
  })
  await $fetch(`${api()}/nostr/link`, {
    method: 'POST',
    credentials: 'include',
    body: {
      event: signed,
      signer_type: signerType,
      label: identityLabel.value.trim() || null,
      mode: linkMode.value,
    },
  })
  setStatus(t('nostr_account.linked'))
  generated.value = null
  revealNsec.value = false
  await Promise.all([load()])
}

async function performLink(
  signEventFn: (
    ev: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>,
  signerType: string,
) {
  busy.value = true
  status.value = null
  qrOpen.value = false
  try {
    await linkWithSigner({ signEvent: signEventFn }, signerType)
  } catch (e: any) {
    setStatus(e?.data ?? e?.message ?? t('nostr_account.link_failed'), 'error')
  } finally {
    busy.value = false
  }
}

async function linkWithNip07() {
  const nostr = (window as NostrWindow).nostr
  if (!nostr) {
    setStatus(t('nostr_account.extension_missing'), 'error')
    return
  }
  await performLink(async (event) => {
    event.pubkey = await nostr.getPublicKey()
    return nostr.signEvent(event)
  }, 'nip07')
}

async function linkWithBunker() {
  const ui = (window as NostrWindow).NostrConnectUI
  if (!ui || !bunkerInput.value.trim()) return
  busy.value = true
  status.value = null
  try {
    const signer = await ui.connectViaBunkerUri(bunkerInput.value.trim())
    await linkWithSigner(signer, 'nip46')
    refreshSaved()
  } catch (e: any) {
    setStatus(e?.message ?? t('nostr_account.link_failed'), 'error')
  } finally {
    busy.value = false
  }
}

let qrAbort: AbortController | null = null

async function linkWithQr() {
  const ui = (window as NostrWindow).NostrConnectUI
  if (!ui) return
  qrAbort = new AbortController()
  qrOpen.value = true
  qrDataUrl.value = ''
  qrUri.value = ''
  busy.value = true
  status.value = null
  try {
    const signer = await ui.connectViaQr((uri, dataUrl) => {
      qrUri.value = uri
      qrDataUrl.value = dataUrl
    }, qrAbort.signal)
    qrOpen.value = false
    await linkWithSigner(signer, 'nip46')
    refreshSaved()
  } catch (e: any) {
    if (!qrAbort.signal.aborted) {
      setStatus(e?.message ?? t('nostr_account.qr_timeout'), 'error')
    }
  } finally {
    qrOpen.value = false
    busy.value = false
    qrAbort = null
  }
}

function cancelQr() {
  qrAbort?.abort()
  qrOpen.value = false
}

function generateLocalKey() {
  const ui = (window as NostrWindow).NostrConnectUI
  if (!ui) return
  const keypair = ui.generateLocalKeypair()
  generated.value = {
    secretKeyHex: keypair.secretKeyHex,
    nsec: keypair.nsec,
    npub: keypair.npub,
  }
  revealNsec.value = false
  rememberKey.value = false
}

async function useGeneratedKey() {
  const ui = (window as NostrWindow).NostrConnectUI
  if (!ui || !generated.value) return
  if (rememberKey.value) ui.saveLocalKey(generated.value.secretKeyHex)
  await performLink(
    (event) =>
      ui.createLocalSigner(generated.value!.secretKeyHex).signEvent(event),
    'unknown',
  )
  refreshSaved()
}

async function usePasskey() {
  const pk = (window as NostrWindow).NostrPasskey
  if (!pk) {
    setStatus(t('nostr_account.passkey_unavailable'), 'error')
    return
  }
  busy.value = true
  status.value = null
  try {
    let identity
    if (pk.hasStoredPasskeyIdentity()) {
      identity = await pk.unlockPasskeyIdentity()
    } else if (generated.value) {
      identity = await pk.importPasskeyIdentityFromNsec(
        generated.value.nsec,
        passkeyOpts(),
      )
    } else {
      identity = await pk.registerPasskeyIdentity(passkeyOpts())
    }
    await linkWithSigner(
      pk.buildPasskeySignerShim(identity.secretKey),
      'passkey',
    )
    refreshSaved()
  } catch (e: any) {
    setStatus(e?.message ?? t('nostr_account.passkey_failed'), 'error')
  } finally {
    busy.value = false
  }
}

async function revealRecovery() {
  const pk = (window as NostrWindow).NostrPasskey
  if (!pk || !hasPasskey.value) return
  if (recoveryNsec.value) {
    recoveryNsec.value = ''
    return
  }
  try {
    recoveryNsec.value = await pk.exportPasskeyIdentityAsNsec()
    setStatus(t('nostr_account.recovery_revealed'))
  } catch (e: any) {
    setStatus(e?.message ?? t('nostr_account.recovery_failed'), 'error')
  }
}

async function copyRecovery() {
  if (!recoveryNsec.value) return
  try {
    await navigator.clipboard.writeText(recoveryNsec.value)
    setStatus(t('nostr_account.recovery_copied'))
  } catch {
    setStatus(t('nostr_account.recovery_copy_manual'), 'error')
  }
}

const restoreNsec = ref('')

async function restorePasskey() {
  const pk = (window as NostrWindow).NostrPasskey
  if (!pk || hasPasskey.value || !restoreNsec.value.trim()) return
  busy.value = true
  status.value = null
  try {
    const identity = await pk.importPasskeyIdentityFromNsec(
      restoreNsec.value.trim(),
      passkeyOpts(),
    )
    await linkWithSigner(
      pk.buildPasskeySignerShim(identity.secretKey),
      'passkey',
    )
    refreshSaved()
  } catch (e: any) {
    setStatus(e?.message ?? t('nostr_account.passkey_failed'), 'error')
  } finally {
    restoreNsec.value = ''
    busy.value = false
  }
}

function forgetPasskey() {
  const pk = (window as NostrWindow).NostrPasskey
  if (!pk || !hasPasskey.value) return
  if (!window.confirm(t('nostr_account.passkey_forget_confirm'))) return
  pk.clearPasskeyIdentity()
  recoveryNsec.value = ''
  refreshSaved()
  setStatus(t('nostr_account.passkey_forgotten'))
}

async function rename(identity: Identity) {
  const label = window.prompt(
    t('nostr_account.rename_prompt'),
    identity.label ?? '',
  )
  if (label === null) return
  if (!label.trim()) {
    setStatus(t('nostr_account.rename_required'), 'error')
    return
  }
  try {
    await $fetch(`${api()}/nostr/identities/rename`, {
      method: 'POST',
      credentials: 'include',
      body: { identity_id: identity.id, label: label.trim() },
    })
    await load()
  } catch (e: any) {
    setStatus(e?.data ?? t('nostr_account.rename_failed'), 'error')
  }
}

async function revoke(identity: Identity) {
  if (!window.confirm(t('nostr_account.revoke_confirm'))) return
  try {
    await $fetch(`${api()}/nostr/identities/revoke`, {
      method: 'POST',
      credentials: 'include',
      body: { identity_id: identity.id },
    })
    await load()
  } catch (e: any) {
    setStatus(e?.data ?? t('nostr_account.revoke_failed'), 'error')
  }
}

async function unlinkAll() {
  if (!window.confirm(t('nostr_account.unlink_confirm'))) return
  try {
    await $fetch(`${api()}/nostr/unlink`, {
      method: 'POST',
      credentials: 'include',
    })
    ;(window as NostrWindow).NostrConnectUI?.clearAllSaved()
    await Promise.all([load()])
  } catch (e: any) {
    setStatus(e?.data ?? t('nostr_account.unlink_failed'), 'error')
  }
}

function forgetBunker() {
  ;(window as NostrWindow).NostrConnectUI?.clearSaved()
  refreshSaved()
}

function forgetLocalKey() {
  ;(window as NostrWindow).NostrConnectUI?.clearLocalKey()
  refreshSaved()
}

function formatTimestamp(unix: number | null) {
  if (!unix) return t('nostr_account.never')
  return new Date(unix * 1000).toLocaleString()
}

onMounted(async () => {
  const isLoggedIn = useIsLoggedIn()
  if (!isLoggedIn.value) {
    await navigateTo('/login')
    return
  }
  // Wait briefly for the deferred vendor scripts before the first load() so
  // the saved-signer/passkey status is accurate.
  let attempts = 0
  const check = async () => {
    if ((window as NostrWindow).NostrConnectUI || attempts++ > 50) {
      await load()
    } else {
      setTimeout(check, 100)
    }
  }
  await check()
})
</script>

<template>
  <div class="mx-auto w-full max-w-3xl pb-12">
    <PageTitle :text="t('nostr_account.title')" tag="h1" class="mb-4" />

    <BaseAlert
      v-if="status"
      :variant="status.kind === 'error' ? 'error' : 'success'"
      :message="status.text"
      class="mb-4"
      assertive
    />

    <p v-if="loading" class="text-portal-muted">
      {{ t('nostr_account.loading') }}
    </p>

    <template v-else>
      <p class="mb-6 text-sm text-portal-muted">
        {{
          identities.filter((i) => i.enabled).length
            ? t('nostr_account.has_identities', {
                count: identities.filter((i) => i.enabled).length,
              })
            : t('nostr_account.no_identities')
        }}
      </p>

      <section v-if="identities.length" class="mb-8 space-y-3">
        <div
          v-for="identity in identities"
          :key="identity.id"
          class="rounded-2xl border border-portal-border bg-portal-surface p-5"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span class="font-bold">{{
                identity.label || t('nostr_account.unnamed')
              }}</span>
              <span
                v-if="!identity.enabled"
                class="ms-2 rounded-md bg-brand-500/10 px-2 py-1 text-xs text-brand-500"
                >{{ t('nostr_account.revoked') }}</span
              >
            </div>
            <div v-if="identity.enabled" class="flex gap-2">
              <YButton
                icon="pencil"
                :text="t('nostr_account.rename')"
                @click.prevent="rename(identity)"
              />
              <YButton
                icon="close"
                :text="t('nostr_account.revoke')"
                @click.prevent="revoke(identity)"
              />
            </div>
          </div>
          <p class="mt-1 break-all font-mono text-sm opacity-70">
            {{ identity.npub }}
          </p>
          <p class="mt-1 text-sm opacity-60">
            {{ signerLabel(identity.signer_type) }} ·
            {{
              t('nostr_account.last_used', {
                date: formatTimestamp(identity.last_used),
              })
            }}
          </p>
        </div>
      </section>

      <section
        v-if="allowLinking"
        class="mb-8 rounded-2xl border border-portal-border bg-portal-surface p-5 sm:p-6"
      >
        <h2 class="mb-3 text-lg font-bold">
          {{ t('nostr_account.link_section') }}
        </h2>
        <div class="mb-4 flex flex-wrap items-center gap-4">
          <label
            for="link-mode-replace"
            class="flex items-center gap-2 text-sm"
          >
            <input
              id="link-mode-replace"
              v-model="linkMode"
              class="accent-brand-500"
              type="radio"
              value="replace"
            />
            {{ t('nostr_account.mode_replace') }}
          </label>
          <label for="link-mode-add" class="flex items-center gap-2 text-sm">
            <input
              id="link-mode-add"
              v-model="linkMode"
              class="accent-brand-500"
              type="radio"
              value="add"
              :disabled="!identities.length"
            />
            {{ t('nostr_account.mode_add') }}
          </label>
          <input
            id="nostr-account-label"
            aria-label="Identity label"
            v-model="identityLabel"
            class="portal-account-input"
            :placeholder="t('nostr_account.label_placeholder')"
            autocomplete="off"
          />
        </div>

        <div class="space-y-2">
          <YButton
            icon="login"
            :text="t('nostr_account.link_nip07')"
            block
            :disabled="busy"
            @click.prevent="linkWithNip07"
          />

          <div class="flex gap-2">
            <input
              v-model="bunkerInput"
              aria-label="Remote signer address"
              class="portal-account-input min-w-0 flex-1"
              :placeholder="t('nostr_account.bunker_placeholder')"
              autocomplete="off"
            />
            <YButton
              :text="t('nostr_account.bunker_connect')"
              :disabled="busy || !bunkerInput.trim()"
              @click.prevent="linkWithBunker"
            />
            <YButton
              :text="t('nostr_account.qr_show')"
              :disabled="busy"
              @click.prevent="linkWithQr"
            />
          </div>

          <div
            v-if="qrOpen"
            class="flex flex-col items-center gap-2 rounded-xl border border-portal-border bg-portal-elevated p-4"
          >
            <img v-if="qrDataUrl" :src="qrDataUrl" class="h-52 w-52" alt="" />
            <p class="break-all text-xs opacity-60">{{ qrUri }}</p>
            <YButton
              :text="t('nostr_account.qr_cancel')"
              @click.prevent="cancelQr"
            />
          </div>

          <div class="flex flex-wrap gap-2">
            <YButton
              :text="t('nostr_account.generate')"
              :disabled="busy"
              @click.prevent="generateLocalKey"
            />
            <YButton
              v-if="hasPasskey"
              :text="t('nostr_account.passkey_use')"
              :disabled="busy"
              @click.prevent="usePasskey"
            />
            <YButton
              v-else
              :text="
                generated
                  ? t('nostr_account.passkey_protect')
                  : t('nostr_account.passkey_create')
              "
              :disabled="busy"
              @click.prevent="usePasskey"
            />
            <YButton
              v-if="hasPasskey"
              :text="t('nostr_account.passkey_recovery')"
              :disabled="busy"
              @click.prevent="revealRecovery"
            />
            <YButton
              v-if="hasPasskey"
              :text="t('nostr_account.passkey_forget')"
              :disabled="busy"
              @click.prevent="forgetPasskey"
            />
          </div>

          <div v-if="recoveryNsec" class="space-y-2">
            <p class="break-all font-mono text-xs">{{ recoveryNsec }}</p>
            <YButton
              :text="t('nostr_account.recovery_copy')"
              @click.prevent="copyRecovery"
            />
          </div>

          <div v-if="!hasPasskey" class="flex gap-2">
            <input
              v-model="restoreNsec"
              aria-label="Recovery key"
              class="portal-account-input min-w-0 flex-1"
              :placeholder="t('nostr_account.recovery_restore_placeholder')"
              autocomplete="off"
            />
            <YButton
              :text="t('nostr_account.recovery_restore')"
              :disabled="busy || !restoreNsec.trim()"
              @click.prevent="restorePasskey"
            />
          </div>

          <div
            v-if="generated"
            class="rounded-xl border border-portal-border bg-portal-elevated p-4"
          >
            <p class="break-all font-mono text-sm">{{ generated.npub }}</p>
            <p class="mt-1 break-all font-mono text-sm">
              {{ revealNsec ? generated.nsec : '•'.repeat(63) }}
            </p>
            <div class="mt-2 flex flex-wrap items-center gap-3">
              <YButton
                :text="
                  revealNsec
                    ? t('nostr_account.hide_nsec')
                    : t('nostr_account.reveal_nsec')
                "
                @click.prevent="revealNsec = !revealNsec"
              />
              <YButton
                :text="t('nostr_account.copy_nsec')"
                @click.prevent="navigator.clipboard.writeText(generated.nsec)"
              />
              <label
                for="remember-generated-key"
                class="flex items-center gap-2 text-sm"
              >
                <input
                  id="remember-generated-key"
                  v-model="rememberKey"
                  class="accent-brand-500"
                  type="checkbox"
                />
                {{ t('nostr_account.remember_key') }}
              </label>
              <YButton
                :text="t('nostr_account.use_generated')"
                :disabled="busy"
                @click.prevent="useGeneratedKey"
              />
            </div>
          </div>
        </div>
      </section>

      <section
        v-else
        class="mb-8 rounded-2xl border border-portal-border bg-portal-surface p-5 text-portal-muted"
      >
        {{ t('nostr_account.linking_disabled') }}
      </section>

      <section
        v-if="savedSigners || hasLocalKey"
        class="mb-8 rounded-2xl border border-portal-border bg-portal-surface p-5"
      >
        <h2 class="mb-3 text-lg font-bold">
          {{ t('nostr_account.saved_signers') }}
        </h2>
        <div
          v-if="savedSigners"
          class="flex items-center justify-between gap-2 py-1"
        >
          <span class="text-sm">
            {{ t('nostr_account.saved_bunker') }}:
            <span class="font-mono">{{ savedSigners.relays.join(', ') }}</span>
          </span>
          <YButton
            :text="t('nostr_account.forget')"
            @click.prevent="forgetBunker"
          />
        </div>
        <div
          v-if="hasLocalKey"
          class="flex items-center justify-between gap-2 py-1"
        >
          <span class="text-sm">{{ t('nostr_account.saved_local') }}</span>
          <YButton
            :text="t('nostr_account.forget')"
            @click.prevent="forgetLocalKey"
          />
        </div>
      </section>

      <YButton
        v-if="identities.some((i) => i.enabled)"
        icon="close"
        :text="t('nostr_account.unlink_all')"
        :disabled="busy"
        @click.prevent="unlinkAll"
      />
    </template>
  </div>
</template>

<style scoped>
.portal-account-input {
  @apply rounded-[10px] border border-portal-border bg-portal-input px-3 py-3 text-sm text-portal-foreground placeholder:text-portal-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30;
}
</style>
