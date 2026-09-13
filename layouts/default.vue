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
  const links: { text: string; to: string; newWindow?: boolean }[] = [
    { text: t('footerlink_edit'), to: '/edit' },
    { text: t('footerlink_nostr_identity'), to: '/nostr-account' },
  ]
  // The admin console is same-origin and only meaningful for admins; the
  // console itself refuses non-admins, so gate the link on the account flag.
  if (user.value?.admin) {
    links.push({
      text: t('footerlink_administration'),
      to: '/nostrhost/admin/',
    })
  }
  return links
})

async function logout() {
  const { error } = await useApi('/logout')

  if (!error.value) {
    // Delete user infos
    user.value = null
    isLoggedIn.value = false
    await navigateTo(settings.value.public ? '/' : '/login')
  } else {
    // FIXME : display an error or something
  }
}
</script>

<template>
  <div
    class="container mx-auto flex min-h-screen flex-col px-5 py-6 sm:px-8 sm:py-8"
  >
    <BaseAlert
      v-if="queryMsg"
      variant="warning"
      icon="alert-outline"
      :message="t('ssowat.' + queryMsg)"
      class="mb-4"
      assertive
    />

    <header
      class="mb-8 rounded-2xl border border-portal-border bg-portal-surface px-5 py-4 sm:px-6"
    >
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
        <div class="flex flex-row items-center gap-4">
          <NuxtLink
            to="/"
            class="flex min-w-0 items-center gap-3 text-portal-foreground no-underline"
          >
            <span class="sr-only">{{ t('back_to_apps') }}</span>
            <span
              class="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-500"
            >
              <YIcon name="shield-check" size="1.25rem" aria-hidden="true" />
            </span>
            <span class="truncate text-base font-bold tracking-tight">{{
              portalTitle
            }}</span>
          </NuxtLink>

          <div
            class="flex flex-grow flex-wrap items-center justify-end gap-3 max-[500px]:flex-col max-[500px]:items-end"
          >
            <div v-if="user" class="flex-grow">
              <div class="profile flex flex-col items-end">
                <span class="flex items-center gap-2">
                  <span class="text-sm font-bold leading-none">
                    {{ user.fullname || user.username }}
                  </span>

                  <NuxtLink
                    to="/edit"
                    class="link"
                    :aria-label="t('footerlink_edit')"
                  >
                    <YIcon name="pencil" size="1em" />
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
                icon="logout"
                :text="t('logout')"
                @click.prevent="logout"
              />
              <YButton v-else icon="login" :text="t('login')" to="/login" />
            </div>
          </div>
        </div>
      </slot>
    </header>

    <main>
      <slot />
    </main>

    <footer
      v-if="isLoggedIn"
      id="main-footer"
      class="mt-auto focus-target border-t border-portal-border pt-4"
      tabindex="-1"
    >
      <slot name="footer">
        <nav
          class="flex flex-col flex-wrap gap-4 text-center sm:flex-row sm:text-left"
        >
          <NuxtLink
            v-for="link in footerLinks"
            :key="link.to"
            :to="link.to"
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
