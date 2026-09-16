<script setup lang="ts">
import NostrAccountPage from '@/pages/nostr-account.vue'

const route = useRoute()
const section = computed(() => String(route.params.section || 'profile'))
if (!['profile', 'identity', 'preferences'].includes(section.value)) {
  await navigateTo('/account/profile', { replace: true })
}

const { t, locales, getBrowserLocale } = useI18n()
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
    theme === 'auto'
      ? t('automatic', { name: settings.value.portal_theme })
      : theme.charAt(0).toUpperCase() + theme.slice(1),
  value: theme,
}))

useHead({
  title:
    section.value === 'identity'
      ? t('nostr_account.title')
      : t('footerlink_edit'),
})
</script>

<template>
  <div class="mx-auto w-full max-w-5xl pb-12">
    <PageTitle text="Account" class="mb-2" />
    <p class="mb-6 text-sm text-portal-muted">
      Your profile, sign-in identity, recovery and browser preferences.
    </p>
    <AccountNav />

    <section v-if="section === 'profile'" class="py-2">
      <div class="mb-5 flex items-center gap-4">
        <div
          class="grid size-12 shrink-0 place-items-center border border-portal-signature bg-portal-selection font-mono text-sm font-bold text-portal-signature"
        >
          {{ userInitials }}
        </div>
        <div>
          <h2 class="text-lg font-bold">{{ t('edit_personal_settings') }}</h2>
          <p class="mt-1 text-sm text-portal-muted">
            {{ t('edit_personal_desc') }}
          </p>
        </div>
      </div>
      <UserInfoForm />
    </section>

    <section v-else-if="section === 'preferences'" class="py-2">
      <h2 class="text-lg font-bold">{{ t('edit_browser_settings') }}</h2>
      <p class="mb-5 mt-1 text-sm text-portal-muted">
        These preferences are stored in this browser.
      </p>
      <form class="grid gap-5 sm:grid-cols-2" novalidate @submit.prevent>
        <div class="flex flex-col gap-2">
          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
          <label for="account-language" class="text-sm font-semibold">{{
            t('language')
          }}</label>
          <select
            id="account-language"
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
          <label for="account-theme" class="text-sm font-semibold">{{
            t('theme')
          }}</label>
          <select
            id="account-theme"
            v-model="preferedTheme"
            class="portal-select"
          >
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

    <div v-else class="account-identity">
      <NostrAccountPage />
    </div>
  </div>
</template>

<style scoped>
.portal-select {
  @apply rounded-[3px] border border-portal-border bg-portal-input px-3 py-3 text-sm text-portal-foreground focus:border-portal-focus focus:outline-none;
}

.account-identity :deep(> div) {
  max-width: none;
  padding-bottom: 0;
}

.account-identity :deep(h1) {
  display: none;
}
</style>
