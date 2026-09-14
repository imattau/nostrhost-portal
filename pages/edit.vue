<script setup lang="ts">
const { t, locales, getBrowserLocale } = useI18n()

useHead({
  title: t('footerlink_edit'),
})

const settings = await useSettings()
const preferedTheme = await usePreferedTheme()
const preferedLocale = usePreferedLocale()
const user = await useUser()
const userInitials = computed(() =>
  (user.value?.fullname || user.value?.username || 'N')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join(''),
)

const localesAsOptions = computed(() => {
  const options = locales.value.map((locale) => ({
    text: locale.name,
    value: locale.code,
  }))
  const browserLocale = getBrowserLocale()
  const browserLocaleName = locales.value.find(
    (locale) => locale.code === browserLocale,
  )?.name
  options.unshift({
    text: t('automatic', { name: browserLocaleName }),
    value: 'auto',
  })

  return options
})

const themesAsOptions = ['auto', 'light', 'dark'].map((theme) => ({
  text:
    theme !== 'auto'
      ? theme.charAt(0).toUpperCase() + theme.slice(1)
      : t('automatic', { name: settings.value.portal_theme }),
  value: theme,
}))
</script>

<template>
  <div class="mx-auto w-full max-w-5xl pb-12">
    <PageTitle :text="$t('footerlink_edit')" class="mb-2" />
    <p class="mb-6 text-sm text-portal-muted">
      Manage your portal preferences and Nostr sign-in methods.
    </p>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div class="space-y-6">
        <section
          class="rounded-2xl border border-portal-border bg-portal-surface p-5 sm:p-6"
        >
          <div class="mb-4 flex items-center gap-4">
            <div
              class="grid size-14 shrink-0 place-items-center rounded-full border-2 border-brand-500 bg-brand-500/10 text-lg font-bold text-brand-500"
            >
              {{ userInitials }}
            </div>
            <div>
              <h2 class="text-lg font-bold">
                {{ t('edit_personal_settings') }}
              </h2>
              <p class="mt-1 text-sm text-portal-muted">
                Update the name shown in your portal.
              </p>
            </div>
          </div>
          <div class="mb-4 h-px bg-portal-border" />
          <UserInfoForm />
        </section>

        <section
          class="rounded-2xl border border-portal-border bg-portal-surface p-5 sm:p-6"
        >
          <h2 class="text-lg font-bold">{{ t('edit_browser_settings') }}</h2>
          <p class="mb-4 mt-1 text-sm text-portal-muted">
            These preferences are stored in this browser.
          </p>
          <form class="grid gap-5 sm:grid-cols-2" novalidate @submit.prevent>
            <div class="flex flex-col gap-2">
              <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
              <label for="language" class="text-sm font-semibold">{{
                t('language')
              }}</label>
              <select
                id="language"
                v-model="preferedLocale"
                class="portal-select"
              >
                <option
                  v-for="option in localesAsOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.text }}
                </option>
              </select>
            </div>
            <div class="flex flex-col gap-2">
              <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
              <label for="theme" class="text-sm font-semibold">{{
                t('theme')
              }}</label>
              <select id="theme" v-model="preferedTheme" class="portal-select">
                <option
                  v-for="option in themesAsOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.text }}
                </option>
              </select>
            </div>
          </form>
        </section>
      </div>

      <aside class="space-y-6">
        <section
          class="rounded-2xl border border-portal-border bg-portal-surface p-6"
        >
          <div
            class="mb-4 grid size-10 place-items-center rounded-lg bg-brand-500/10 text-brand-500"
          >
            <YIcon name="key-chain" size="1.25rem" aria-hidden="true" />
          </div>
          <h2 class="text-base font-bold">Nostr identity</h2>
          <p class="mt-2 text-sm leading-6 text-portal-muted">
            Link and manage browser extensions, remote signers, passkeys, and
            recovery keys.
          </p>
          <YButton
            class="mt-5"
            text="Manage Nostr identities"
            variant="secondary"
            block
            to="/nostr-account"
          />
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.portal-select {
  @apply rounded-[10px] border border-portal-border bg-portal-input px-3 py-3 text-sm text-portal-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30;
}
</style>
