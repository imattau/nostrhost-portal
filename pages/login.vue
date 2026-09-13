<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/yup'
import * as yup from 'yup'

definePageMeta({
  layout: false,
  public: true,
})

const { t } = useI18n()
const settings = await useSettings()
const settingsTitle = computed(() =>
  settings.value.portal_title && !/yunohost/i.test(settings.value.portal_title)
    ? settings.value.portal_title
    : 'NostrHost Service Portal',
)

useHead({
  title: t('login'),
})

const isLoggedIn = useIsLoggedIn()
const redirectUrl = useRedirectUrl()
const queryMsg = useQueryMsg()

const { handleSubmit, setErrors } = useForm({
  validationSchema: toTypedSchema(
    yup.object({
      username: yup.string().required(),
      password: yup.string().required(),
    }),
  ),
})

const login = handleSubmit(async (form) => {
  const { error } = await useApi('/login', {
    method: 'POST',
    body: { credentials: form.username + ':' + form.password },
  })

  if (!error.value) {
    if (redirectUrl.value) {
      await navigateTo(atob(redirectUrl.value), { external: true })
    }

    isLoggedIn.value = true
    await navigateTo('/')
  } else {
    setErrors({
      username: t('possibly_invalid_username'),
      password: t('possibly_invalid_password'),
    })
  }
})
</script>

<template>
  <main class="flex min-h-screen items-center justify-center px-5 py-12">
    <section
      class="w-full max-w-[460px] rounded-3xl border border-portal-border bg-portal-surface p-6 shadow-2xl sm:p-12"
    >
      <div class="mb-8 flex flex-col items-center text-center">
        <span
          class="mb-4 grid size-12 place-items-center rounded-xl bg-brand-500/10 text-brand-500"
        >
          <YIcon name="shield-check" size="1.5rem" aria-hidden="true" />
        </span>
        <h1 class="text-2xl font-extrabold tracking-tight">
          {{ settingsTitle }}
        </h1>
        <p class="mt-2 text-sm text-portal-muted">
          {{ t('login') }} with your account credentials
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

      <form novalidate @submit="login">
        <FormField name="username" :label="t('username')" class="mb-4">
          <TextInput
            name="username"
            type="text"
            :placeholder="t('username')"
            autocomplete="username"
            autocapitalize="off"
            spellcheck="false"
          />
        </FormField>

        <FormField name="password" :label="t('password')" class="mb-5">
          <TextInput
            name="password"
            type="password"
            :placeholder="t('password')"
            autocomplete="current-password"
          />
        </FormField>

        <YButton :text="t('login')" type="submit" block />
      </form>

      <div class="my-6 flex items-center gap-3 text-xs text-portal-muted">
        <span class="h-px flex-1 bg-portal-border" />
        Or
        <span class="h-px flex-1 bg-portal-border" />
      </div>
      <YButton
        :text="t('nostr.sign_in')"
        variant="secondary"
        block
        to="/nostr-login"
      />
    </section>
  </main>
</template>
