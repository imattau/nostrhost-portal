<script setup lang="ts">
const { t, locales, getBrowserLocale } = useI18n()

useHead({
  title: t('footerlink_edit'),
})

const settings = await useSettings()
const preferedTheme = await usePreferedTheme()
const preferedLocale = usePreferedLocale()

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
  <div>
    <PageTitle :text="$t('footerlink_edit')" />

    <div class="lg:flex lg:justify-between">
      <section
        class="my-10 h-full rounded-lg border border-gray-200 dark:border-gray-700 lg:me-20 lg:w-1/2"
      >
        <div class="rounded-t-lg bg-gray-100 px-8 py-4 dark:bg-gray-800">
          <h2 class="text-3xl">{{ t('edit_personal_settings') }}</h2>
        </div>

        <UserInfoForm class="p-8" />
      </section>

      <section
        class="my-10 rounded-lg border border-gray-200 dark:border-gray-700 lg:w-1/2"
      >
        <div class="rounded-t-lg bg-gray-100 px-8 py-4 dark:bg-gray-800">
          <h2 class="text-3xl">{{ $t('change_password') }}</h2>
        </div>

        <UserPasswordForm class="p-8" />
      </section>
    </div>

    <section class="my-10 rounded-lg border border-gray-200 dark:border-gray-700">
      <div class="rounded-t-lg bg-gray-100 px-8 py-4 dark:bg-gray-800">
        <h2 class="text-3xl">{{ t('edit_browser_settings') }}</h2>
      </div>

      <form class="p-8" novalidate @submit.prevent>
        <div role="group" class="align mb-3 flex flex-wrap items-center">
          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
          <label for="language" class="me-3">{{ t('language') }}</label>
          <select
            id="language"
            v-model="preferedLocale"
            class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
          >
            <option disabled selected>{{ t('language') }}</option>
            <option
              v-for="option in localesAsOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.text }}
            </option>
          </select>
        </div>

        <div role="group" class="align flex flex-wrap items-center">
          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
          <label for="theme" class="me-3">{{ t('theme') }}</label>
          <select
            id="theme"
            v-model="preferedTheme"
            class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
          >
            <option disabled selected>{{ t('theme') }}</option>
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
</template>
