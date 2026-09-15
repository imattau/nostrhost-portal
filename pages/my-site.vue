<script setup lang="ts">
import {
  hasStoredPasskeyIdentity,
  unlockPasskeyIdentity,
  buildPasskeySignerShim,
} from 'nostr-passkey'
import {
  aggregateSize,
  blobBytesOfFile,
  inventoryFromFiles,
  uploadToBlossom,
  NsiteError,
  type InventoryItem,
  type ManifestItem,
} from '@/utils/nsite'
import {
  connectNip07Signer,
  useNostrConnectScripts,
  NostrExtensionMissingError,
  type NostrSigner,
  type NostrWindow,
} from '@/composables/nostrSigner'
import { useAsyncAction, useStatus } from '@/composables/asyncAction'

definePageMeta({ public: false })

const { t } = useI18n()

useHead({ title: t('my_site.title') })
useNostrConnectScripts()

const portalApi = () => useApiEndpoint()
const nativeApi = () => useApiEndpoint('/package')

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

interface NsitePlan {
  pubkey: string
  kind: number
  d: string
  items: ManifestItem[]
  servers: string[]
  relays: string[]
  copy_of: string
  unsigned_event: {
    kind: number
    pubkey: string
    created_at: number
    tags: string[][]
    content: string
  }
  plan_sha256: string
}

const KIND_ROOT = 15128
const KIND_NAMED = 35128
const DEFAULT_SERVERS = 'https://blossom.primal.net, https://blossom.band'

const signer = ref<NostrSigner | null>(null)
const signerPubkey = ref('')
const { status, setStatus } = useStatus()
const { busy: signerBusy, run: runSignerAction } = useAsyncAction()
const { busy: building, run: runBuild } = useAsyncAction()
const { busy: publishing, run: runPublish } = useAsyncAction()
const identities = ref<Identity[]>([])
const savedSignerAvailable = ref(false)
const passkeyAvailable = ref(false)
const bunkerInput = ref('')

const files = ref<File[]>([])
const fileInputKey = ref(0)
const inventory = ref<InventoryItem[] | null>(null)
const inventoryError = ref('')

const kind = ref(String(KIND_ROOT))
const dTag = ref('')
const serversInput = ref(DEFAULT_SERVERS)

const plan = ref<NsitePlan | null>(null)
const uploadProgress = ref('')

const sites = ref<Record<string, unknown>[]>([])
const sitesScopeDenied = ref(false)

const servers = computed(() =>
  serversInput.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

const fileMap = computed(() => {
  const map = new Map<string, File>()
  for (const file of files.value) {
    const relative = file.webkitRelativePath || file.name
    if (!relative) continue
    const parts = relative.split('/').filter(Boolean)
    map.set('/' + (parts.length > 1 ? parts.slice(1) : parts).join('/'), file)
  }
  return map
})

const linkedPubkey = computed(() =>
  identities.value.some((identity) => identity.pubkey === signerPubkey.value),
)

async function signerPublicKey(s: NostrSigner): Promise<string> {
  if (typeof s.getPublicKey === 'function') return s.getPublicKey()
  const event = await s.signEvent({
    kind: 22242,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: '',
  })
  return (event.pubkey as string) || ''
}

async function useSigner(s: NostrSigner) {
  await runSignerAction(
    async () => {
      signer.value = s
      signerPubkey.value = await signerPublicKey(s)
      await loadSites()
    },
    {
      clear: () => {
        status.value = null
      },
      onError: (e) => setStatus(e?.message ?? String(e), 'error'),
    },
  )
}

async function connectExtension() {
  let nip07: NostrSigner
  try {
    nip07 = connectNip07Signer()
  } catch (e) {
    if (!(e instanceof NostrExtensionMissingError)) throw e
    setStatus(t('my_site.extension_missing'), 'error')
    return
  }
  await useSigner(nip07)
}

async function connectBunker() {
  const ui = (window as NostrWindow).NostrConnectUI
  if (!ui || !bunkerInput.value.trim()) return
  await runSignerAction(
    async () => {
      const s = await ui.connectViaBunkerUri(bunkerInput.value.trim())
      await useSigner(s)
    },
    {
      clear: () => {
        status.value = null
      },
      onError: (e) =>
        setStatus(e?.message ?? t('my_site.connect_failed'), 'error'),
    },
  )
}

async function connectSaved() {
  const ui = (window as NostrWindow).NostrConnectUI
  if (!ui?.hasSaved()) return
  await runSignerAction(
    async () => {
      const s = await ui.reconnectSaved()
      if (s) await useSigner(s)
    },
    {
      clear: () => {
        status.value = null
      },
      onError: (e) =>
        setStatus(e?.message ?? t('my_site.connect_failed'), 'error'),
    },
  )
}

async function connectPasskey() {
  await runSignerAction(
    async () => {
      const identity = await unlockPasskeyIdentity()
      await useSigner(buildPasskeySignerShim(identity.secretKey))
    },
    {
      clear: () => {
        status.value = null
      },
      onError: (e) =>
        setStatus(e?.message ?? t('my_site.connect_failed'), 'error'),
    },
  )
}

async function loadSites() {
  if (!signerPubkey.value) return
  try {
    const resp = await $fetch<{ sites: Record<string, unknown>[] }>(
      `${nativeApi()}/nsite/list`,
      { credentials: 'include' },
    )
    sites.value = (resp.sites ?? []).filter(
      (site) => site.pubkey === signerPubkey.value,
    )
    sitesScopeDenied.value = false
  } catch (e: any) {
    if (e?.statusCode === 403) sitesScopeDenied.value = true
    sites.value = []
  }
}

async function onFilesChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const chosen = Array.from(input.files ?? [])
  files.value = chosen
  inventoryError.value = ''
  inventory.value = null
  plan.value = null
  if (!chosen.length) return
  try {
    inventory.value = await inventoryFromFiles(chosen)
  } catch (e) {
    inventoryError.value = e instanceof Error ? e.message : String(e)
  }
  fileInputKey.value += 1
}

async function buildPlan() {
  if (!signerPubkey.value || !inventory.value?.length) return
  await runBuild(
    async () => {
      const items = inventory.value!.map((item) => ({
        path: item.path,
        sha256: item.sha256,
      }))
      const resp = await $fetch<{ plan: NsitePlan }>(
        `${nativeApi()}/nsite/publish/plan`,
        {
          method: 'POST',
          credentials: 'include',
          body: {
            pubkey: signerPubkey.value,
            kind: Number(kind.value),
            d: kind.value === String(KIND_NAMED) ? dTag.value.trim() : '',
            items,
            servers: servers.value,
          },
        },
      )
      plan.value = resp.plan
      setStatus(t('my_site.plan_ready'))
    },
    {
      clear: () => {
        status.value = null
        plan.value = null
      },
      onError: (e) =>
        setStatus(
          e?.data?.error ?? e?.message ?? t('my_site.plan_failed'),
          'error',
        ),
    },
  )
}

async function publish() {
  if (!signer.value || !plan.value || !inventory.value) return
  await runPublish(
    async () => {
      const p = plan.value!
      const blobBytes = (path: string) => {
        const file = fileMap.value.get(path)
        return file ? blobBytesOfFile(file) : null
      }
      for (const server of p.servers) {
        uploadProgress.value = server
        const result = await uploadToBlossom(server, p.items, blobBytes, {
          pubkey: signerPubkey.value,
          signEvent: (event) => signer.value!.signEvent(event) as any,
        })
        if (!result.ok) {
          const first = Object.values(result.errors)[0]
          throw new NsiteError(
            `blob upload to ${server} failed${first ? `: ${first}` : ''}`,
          )
        }
      }
      uploadProgress.value = ''
      const unsigned = p.unsigned_event
      const signed = (await signer.value!.signEvent({
        ...unsigned,
        created_at: Math.floor(Date.now() / 1000),
      })) as any
      const out = await $fetch<{
        ok: boolean
        reason?: string
        error?: string
      }>(`${nativeApi()}/nsite/publish`, {
        method: 'POST',
        credentials: 'include',
        body: {
          event: signed,
          plan_sha256: p.plan_sha256,
          relays: p.relays,
        },
      })
      if (!out.ok) {
        throw new NsiteError(
          out.reason || out.error || t('my_site.publish_rejected'),
        )
      }
      setStatus(t('my_site.published'))
      plan.value = null
      inventory.value = null
      files.value = []
      await loadSites()
    },
    {
      clear: () => {
        status.value = null
      },
      onError: (e) =>
        setStatus(
          e?.data?.error ?? e?.message ?? t('my_site.publish_failed'),
          'error',
        ),
      onFinally: () => {
        uploadProgress.value = ''
      },
    },
  )
}

onMounted(async () => {
  const ui = (window as NostrWindow).NostrConnectUI
  savedSignerAvailable.value = !!ui?.hasSaved()
  passkeyAvailable.value = hasStoredPasskeyIdentity()
  try {
    const resp = await $fetch<{ identities: Identity[] }>(
      `${portalApi()}/nostr/identities`,
      { credentials: 'include' },
    )
    identities.value = resp.identities ?? []
  } catch {
    identities.value = []
  }
})
</script>

<template>
  <section class="mx-auto max-w-3xl">
    <PageTitle :title="t('my_site.title')" :description="t('my_site.intro')" />

    <BaseAlert
      v-if="status"
      :variant="status.kind"
      icon="alert-outline"
      :message="status.text"
      class="mb-5"
      assertive
    />

    <!-- Signer connection -->
    <section
      class="mb-6 rounded-2xl border border-portal-border bg-portal-surface p-6"
    >
      <h2 class="mb-1 text-lg font-bold text-portal-foreground">
        {{ t('my_site.signer_section') }}
      </h2>
      <p class="mb-4 text-sm leading-6 text-portal-muted">
        {{ t('my_site.signer_hint') }}
      </p>

      <div v-if="signerPubkey" class="space-y-3">
        <p class="flex items-center gap-2 text-sm text-portal-foreground">
          <YIcon name="account-circle" size="1.2em" aria-hidden="true" />
          <span class="font-mono">{{ shortPubkey(signerPubkey) }}</span>
          <span v-if="linkedPubkey" class="text-xs text-green-600">{{
            t('my_site.linked')
          }}</span>
          <span v-else class="text-xs text-amber-600">{{
            t('my_site.not_linked')
          }}</span>
        </p>
        <BaseAlert
          v-if="!linkedPubkey"
          variant="warning"
          icon="alert-outline"
          :message="t('my_site.linked_warning')"
        />
      </div>

      <div v-else class="space-y-3">
        <YButton
          icon="login"
          :text="t('my_site.connect_extension')"
          block
          :disabled="signerBusy"
          @click.prevent="connectExtension"
        />
        <YButton
          v-if="savedSignerAvailable"
          icon="lock"
          :text="t('my_site.connect_saved')"
          block
          variant="secondary"
          :disabled="signerBusy"
          @click.prevent="connectSaved"
        />
        <YButton
          v-if="passkeyAvailable"
          icon="lock"
          :text="t('my_site.connect_passkey')"
          block
          variant="secondary"
          :disabled="signerBusy"
          @click.prevent="connectPasskey"
        />
        <form class="flex gap-2" @submit.prevent="connectBunker">
          <input
            id="my-site-bunker"
            v-model="bunkerInput"
            :aria-label="t('my_site.remote_signer')"
            class="w-full rounded-[10px] border border-portal-border bg-portal-input px-4 py-3 text-sm text-portal-foreground placeholder:text-portal-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            placeholder="bunker:// or NIP-05 signer"
            autocomplete="off"
            :disabled="signerBusy"
          />
          <YButton
            type="submit"
            :text="t('my_site.connect')"
            variant="secondary"
            :disabled="signerBusy || !bunkerInput.trim()"
          />
        </form>
      </div>
    </section>

    <!-- Your sites -->
    <section
      v-if="signerPubkey"
      class="mb-6 rounded-2xl border border-portal-border bg-portal-surface p-6"
    >
      <h2 class="mb-1 text-lg font-bold text-portal-foreground">
        {{ t('my_site.your_sites') }}
      </h2>
      <p class="mb-4 text-sm leading-6 text-portal-muted">
        {{ t('my_site.your_sites_hint') }}
      </p>
      <BaseAlert
        v-if="sitesScopeDenied"
        variant="warning"
        icon="alert-outline"
        :message="t('my_site.read_scope_missing')"
        class="mb-4"
      />
      <div v-if="sites.length" class="grid gap-2">
        <div
          v-for="(site, index) in sites"
          :key="index"
          class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-portal-border px-3 py-2 text-sm"
        >
          <span class="font-mono text-portal-foreground">
            {{ site.kind }}:{{ (site.pubkey as string).slice(0, 8) }}…:{{
              site.d || '-'
            }}
          </span>
          <span v-if="site.title" class="text-portal-muted">{{
            site.title
          }}</span>
        </div>
      </div>
      <p v-else-if="!sitesScopeDenied" class="text-sm text-portal-muted">
        {{ t('my_site.no_sites') }}
      </p>
    </section>

    <!-- Publish -->
    <section
      v-if="signerPubkey"
      class="mb-6 rounded-2xl border border-portal-border bg-portal-surface p-6"
    >
      <h2 class="mb-1 text-lg font-bold text-portal-foreground">
        {{ t('my_site.publish_section') }}
      </h2>
      <p class="mb-4 text-sm leading-6 text-portal-muted">
        {{ t('my_site.publish_hint') }}
      </p>

      <div class="space-y-4">
        <div>
          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
          <label
            for="my-site-directory"
            class="mb-1 block text-sm font-medium text-portal-foreground"
          >
            {{ t('my_site.choose_directory') }}
          </label>
          <input
            id="my-site-directory"
            :key="fileInputKey"
            type="file"
            webkitdirectory
            directory
            multiple
            class="block w-full cursor-pointer rounded-[10px] border border-portal-border bg-portal-input px-3 py-2 text-sm text-portal-foreground"
            @change="onFilesChosen"
          />
          <p v-if="inventory" class="mt-2 text-xs text-portal-muted">
            {{ inventory.length }} {{ t('my_site.files') }} ·
            {{ aggregateSize(inventory).toLocaleString() }}
            {{ t('my_site.bytes') }}
          </p>
          <p v-if="inventoryError" class="mt-2 text-xs text-red-600">
            {{ inventoryError }}
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <div>
            <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
            <label
              for="my-site-kind"
              class="mb-1 block text-sm font-medium text-portal-foreground"
            >
              {{ t('my_site.kind') }}
            </label>
            <select
              id="my-site-kind"
              v-model="kind"
              class="w-full rounded-[10px] border border-portal-border bg-portal-input px-3 py-2 text-sm text-portal-foreground"
            >
              <option :value="String(KIND_ROOT)">
                {{ t('my_site.root') }}
              </option>
              <option :value="String(KIND_NAMED)">
                {{ t('my_site.named') }}
              </option>
            </select>
          </div>
          <div v-if="kind === String(KIND_NAMED)">
            <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
            <label
              for="my-site-d"
              class="mb-1 block text-sm font-medium text-portal-foreground"
            >
              {{ t('my_site.d_label') }}
            </label>
            <input
              id="my-site-d"
              v-model="dTag"
              class="w-full rounded-[10px] border border-portal-border bg-portal-input px-3 py-2 text-sm text-portal-foreground"
              :placeholder="t('my_site.d_placeholder')"
            />
          </div>
          <div :class="kind === String(KIND_NAMED) ? '' : 'sm:col-span-2'">
            <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
            <label
              for="my-site-servers"
              class="mb-1 block text-sm font-medium text-portal-foreground"
            >
              {{ t('my_site.servers') }}
            </label>
            <input
              id="my-site-servers"
              v-model="serversInput"
              class="w-full rounded-[10px] border border-portal-border bg-portal-input px-3 py-2 text-sm text-portal-foreground"
              :placeholder="t('my_site.servers_placeholder')"
            />
          </div>
        </div>

        <YButton
          icon="pencil"
          :text="t('my_site.build_plan')"
          block
          :disabled="building || !inventory?.length"
          @click.prevent="buildPlan"
        />

        <div
          v-if="plan"
          class="grid gap-1.5 rounded-md border border-portal-border px-3 py-2 text-xs"
        >
          <div class="flex justify-between gap-3">
            <span class="text-portal-muted">{{ t('my_site.target') }}</span>
            <code class="font-mono text-portal-foreground"
              >{{ plan.kind }}:{{ plan.pubkey.slice(0, 8) }}…:{{
                plan.d || '-'
              }}</code
            >
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-portal-muted">{{ t('my_site.files') }}</span>
            <span class="font-mono text-portal-foreground">{{
              plan.items.length
            }}</span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-portal-muted">{{ t('my_site.digest') }}</span>
            <code class="font-mono text-portal-foreground"
              >{{ plan.plan_sha256.slice(0, 16) }}…</code
            >
          </div>
        </div>

        <p v-if="uploadProgress" class="text-xs text-portal-muted">
          {{ t('my_site.uploading') }} {{ uploadProgress }}
        </p>

        <YButton
          v-if="plan"
          icon="thumb-up"
          :text="publishing ? t('my_site.publishing') : t('my_site.publish')"
          block
          variant="success"
          :disabled="publishing"
          @click.prevent="publish"
        />
      </div>
    </section>
  </section>
</template>
