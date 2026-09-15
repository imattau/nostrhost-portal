// Shared NIP-07 / NIP-46 signer types and helpers used by the login,
// my-site and nostr-account pages. Consolidates the window augmentation
// types, the "connect via browser extension" flow, the NIP-98-style
// challenge/sign/submit flow, and the nostr-connect vendor/UI script tags
// that were previously hand-copied into each page.

export type NostrSigner = {
  signEvent(event: Record<string, unknown>): Promise<Record<string, unknown>>
  getPublicKey?(): Promise<string>
  close?(): Promise<void>
  destroy?(): void
}

export type NostrConnectUI = {
  hasSaved(): boolean
  getSavedInfo(): { relays: string[]; remoteNpub: string } | null
  listSavedSessions(): Array<{
    sessionId: string
    relays: string[]
    remoteNpub: string
    remotePubkey: string
    label: string | null
    connectedAt: number
  }>
  reconnectSaved(): Promise<NostrSigner | null>
  forgetSession(sessionId: string): void
  connectViaBunkerUri(
    value: string,
    label?: string | null,
  ): Promise<NostrSigner & { sessionId?: string }>
  connectViaQr(
    onUriReady: (uri: string, dataUrl: string) => void,
    signal: AbortSignal,
    label?: string | null,
  ): Promise<NostrSigner & { sessionId?: string }>
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

export type NostrWindow = Window & {
  nostr?: {
    getPublicKey(): Promise<string>
    signEvent(event: Record<string, unknown>): Promise<Record<string, unknown>>
  }
  NostrConnectUI?: NostrConnectUI
}

/** Thrown by {@link connectNip07Signer} when `window.nostr` isn't present. */
export class NostrExtensionMissingError extends Error {}

/**
 * Wraps the `window.nostr` (NIP-07) browser extension API, if present, as a
 * {@link NostrSigner}. Throws {@link NostrExtensionMissingError} otherwise so
 * callers can show their own page-specific "extension missing" message.
 */
export function connectNip07Signer(): NostrSigner {
  const nostr = (window as NostrWindow).nostr
  if (!nostr) throw new NostrExtensionMissingError('nostr extension missing')
  return {
    getPublicKey: () => nostr.getPublicKey(),
    signEvent: async (event) => {
      event.pubkey = await nostr.getPublicKey()
      return nostr.signEvent(event)
    },
  }
}

/**
 * Fetches a server-issued challenge and signs a NIP-98-style kind 22242
 * event for it (challenge/domain/action tags), the flow shared by
 * login (`nostr/challenge` + `nostrhost-login`) and account linking
 * (`nostr/link/challenge` + `nostrhost-link`). Does not submit the signed
 * event - that request differs enough between callers to stay in each page.
 */
export async function signNip98Challenge(
  signer: NostrSigner,
  opts: {
    challengeUrl: string
    challengeMethod?: 'GET' | 'POST'
    action: string
  },
): Promise<Record<string, unknown>> {
  const { challenge } = await $fetch<{ challenge: string }>(opts.challengeUrl, {
    method: opts.challengeMethod ?? 'GET',
    credentials: 'include',
  })
  return signer.signEvent({
    kind: 22242,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['challenge', challenge],
      ['domain', window.location.host],
      ['action', opts.action],
    ],
    content: '',
  })
}

/**
 * Registers the `useHead` script tags for the nostr-connect vendor/UI
 * bundles that the login, my-site and nostr-account pages all depend on.
 */
export function useNostrConnectScripts() {
  useHead({
    script: [
      { src: '/nostrhost/sso/nostr/nostr-connect-vendor.js', defer: true },
      { src: '/nostrhost/sso/nostr/nostr-connect-ui.js', defer: true },
    ],
  })
}
