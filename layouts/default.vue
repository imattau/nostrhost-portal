<script setup lang="ts">
import type { User } from '@/composables/states'

const { t } = useI18n()
const isLoggedIn = useIsLoggedIn()
const queryMsg = useQueryMsg()
const settings = await useSettings()
const portalTitle = computed(() =>
  settings.value.portal_title && !/nostrhost/i.test(settings.value.portal_title)
    ? settings.value.portal_title
    : 'NostrHost Service Portal',
)
const user = await useUser<User | null>()

const footerLinks = computed(() => {
  const links: {
    text: string
    to: string
    newWindow?: boolean
    external?: boolean
  }[] = [
    { text: t('footerlink_edit'), to: '/account/profile' },
    { text: t('footerlink_nostr_identity'), to: '/account/identity' },
    { text: t('footerlink_my_site'), to: '/my-site' },
  ]
  // The admin console is only meaningful for admins; the console itself
  // refuses non-admins, so gate the link on the account flag. Use the
  // canonical URL supplied by the server: portals exist on every registered
  // domain, while the privileged /package/* API intentionally exists only on
  // the primary domain.
  // It must be rendered as an external link: with the Nuxt app baseURL set to
  // /nostrhost/sso, an app-relative to="/nostrhost/admin/" would be
  // double-prefixed into /nostrhost/sso/nostrhost/admin/ and land on the
  // portal's 404 page instead of the console.
  if (user.value?.admin) {
    links.push({
      text: t('footerlink_administration'),
      to: settings.value.admin_url,
      external: true,
    })
  }
  return links
})

const logoutError = ref(false)

async function logout() {
  logoutError.value = false
  const { error } = await useApi('/logout')

  if (!error.value) {
    // Delete user infos
    user.value = null
    isLoggedIn.value = false
    await navigateTo(settings.value.public ? '/' : '/login')
  } else {
    logoutError.value = true
  }
}
</script>

<template>
  <div
    class="mx-auto flex min-h-screen w-full max-w-[1480px] flex-col px-5 pb-6 sm:px-8 lg:px-12"
  >
    <BaseAlert
      v-if="queryMsg"
      variant="warning"
      icon="alert-outline"
      :message="t('ssowat.' + queryMsg)"
      class="mb-4"
      assertive
    />

    <BaseAlert
      v-if="logoutError"
      variant="error"
      icon="alert-outline"
      :message="t('logout_failed')"
      class="mb-4"
      assertive
    />

    <header class="mb-5 border-b border-portal-border py-4 sm:mb-8 sm:py-5">
      <div id="focus-reset" class="h-10 -mt-10 focus-target" tabindex="-1">
        <a class="link sr-only focus:not-sr-only" href="#main-target">
          {{ $t('skip_link.main_content') }}
        </a>
        <a
          v-if="isLoggedIn"
          class="link sr-only focus:not-sr-only"
          href="#main-footer"
        >
          {{ $t('skip_link.footer') }}
        </a>
      </div>

      <slot name="header">
        <div class="flex min-h-12 flex-row items-center gap-4">
          <NuxtLink
            to="/"
            class="flex min-w-0 items-center gap-3 text-portal-foreground no-underline"
          >
            <span class="sr-only">{{ t('back_to_apps') }}</span>
            <span
              class="grid size-8 shrink-0 place-items-center bg-portal-foreground font-mono text-[10px] font-bold tracking-tight text-portal-background"
              aria-hidden="true"
              >NH</span
            >
            <span>
              <span class="block truncate text-base font-bold tracking-tight">{{
                portalTitle
              }}</span>
            </span>
          </NuxtLink>

          <div class="flex flex-grow items-center justify-end gap-4">
            <div v-if="user" class="flex-grow">
              <div class="profile flex flex-col items-end">
                <span class="flex items-center gap-2">
                  <span class="text-sm font-bold leading-none">
                    {{ user.fullname || user.username }}
                  </span>

                  <NuxtLink to="/account/profile" class="link text-xs">
                    {{ t('footerlink_edit') }}
                  </NuxtLink>
                </span>
                <span class="mt-1 text-xs text-portal-muted">{{
                  user.username
                }}</span>
              </div>
            </div>

            <div>
              <YButton
                v-if="isLoggedIn"
                :text="t('logout')"
                variant="secondary"
                @click.prevent="logout"
              />
              <YButton v-else :text="t('login')" to="/login" />
            </div>
          </div>
        </div>
      </slot>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer
      v-if="isLoggedIn"
      id="main-footer"
      class="focus-target mt-10 border-t border-portal-border py-5"
      tabindex="-1"
    >
      <slot name="footer">
        <nav
          class="flex flex-col flex-wrap gap-x-6 gap-y-3 text-sm sm:flex-row"
        >
          <NuxtLink
            v-for="link in footerLinks"
            :key="link.to"
            :to="link.to"
            :external="link.external"
            :target="link.newWindow ? '_blank' : undefined"
            class="link inline-block"
          >
            {{ link.text }}
          </NuxtLink>
        </nav>
      </slot>
    </footer>
  </div>
</template>

<style scoped>
.focus-target:not(:focus-visible) {
  outline: none;
}

#focus-reset {
  outline: none;
}
</style>
