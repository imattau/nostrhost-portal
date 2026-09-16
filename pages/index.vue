<script setup lang="ts">
import { sanitizeHtml } from '~/utils/sanitize'

definePageMeta({
  public: true,
})

const { t, locale } = useI18n()
const isLoggedIn = await useIsLoggedIn()
const settings = await useSettings()
const appsData = await useApps()

useHead({
  title: t('app_list'),
})

const intro = computed(() => {
  const {
    portal_user_intro: userIntro,
    portal_public_intro: publicIntro,
    public: isPublic,
  } = settings.value
  return isLoggedIn.value ? userIntro : isPublic ? publicIntro : null
})

const apps = Object.values(appsData.value).map((app) => {
  return {
    ...app,
    url: '//' + app.url,
    description: app.description?.[locale.value] || app.description?.en,
    label_hash: parseInt(app.label.replaceAll(' ', ''), 36) % 10000,
    initials: app.label.substring(0, 2),
  }
})

const search = ref('')

async function onSearchSubmit() {
  await navigateTo(settings.value.search_engine + search.value, {
    open: {
      target: '_blank',
    },
  })
}

const tileClasses = computed(() => {
  return {
    descriptive: {
      container: 'md:grid-cols-2',
      tile: 'border-t border-portal-border py-4 sm:py-5',
      img: 'me-4 size-14 min-w-14',
      title: 'text-base leading-5 font-semibold',
    },
    simple: {
      container: 'gap-px bg-portal-border border border-portal-border',
      tile: 'flex-col text-center text-base leading-5 font-semibold items-center bg-portal-surface p-5 min-h-44',
      img: 'size-20 min-w-20',
    },
    periodic: {
      container: 'gap-2',
      tile: 'flex-col p-3 items-center',
      title: 'leading-6 text-center text-base',
    },
  }[settings.value.portal_tile_theme]
})
</script>

<template>
  <div>
    <section id="apps" class="mb-10 mt-5 sm:mt-8">
      <div
        class="mb-5 flex flex-col gap-4 border-b border-portal-border pb-5 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <PageTitle :text="t('app_list')" tag="h1" class="m-0" />
          <CustomText
            v-if="intro"
            :content="intro"
            class="mt-2 max-w-2xl text-sm text-portal-muted"
          />
        </div>

        <form
          v-if="settings.search_engine"
          class="flex w-full sm:max-w-md"
          role="search"
          @submit.prevent="onSearchSubmit"
        >
          <div class="flex w-full">
            <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
            <label for="search" class="sr-only">
              {{
                t('search_engine_placeholder', {
                  engine: settings.search_engine_name,
                })
              }}
            </label>
            <input
              id="search"
              v-model="search"
              type="search"
              class="min-h-11 w-full rounded-l-[3px] border border-r-0 border-portal-border bg-portal-input px-3 py-2 text-sm text-portal-foreground placeholder:text-portal-muted focus:z-10 focus:border-portal-focus focus:outline-none"
              name="search"
              :placeholder="
                t('search_engine_placeholder', {
                  engine: settings.search_engine_name,
                })
              "
            />
            <button
              type="submit"
              class="flex min-h-11 shrink-0 items-center rounded-r-[3px] bg-portal-foreground px-4 text-portal-background transition-opacity hover:opacity-80 focus:outline-none"
            >
              <YIcon name="magnify" aria-hidden="true" class="m-0" />
              <span class="sr-only">{{ t('search') }}</span>
            </button>
          </div>
        </form>
      </div>

      <div v-if="!apps.length">
        <em>{{ t('no_apps') }}</em>
      </div>
      <ul
        v-else
        id="app-tiles"
        class="theme-descriptive grid"
        :class="[settings.portal_tile_theme, tileClasses.container]"
      >
        <li
          v-for="app in apps"
          :key="app.label"
          class="app-tile text-align relative flex flex-auto flex-nowrap items-start justify-normal text-left font-normal text-portal-foreground transition-colors"
          :class="tileClasses.tile"
          :style="`--label-hash: ${app.label_hash}`"
        >
          <template v-if="settings.portal_tile_theme !== 'periodic'">
            <img
              v-if="app.logo"
              aria-hidden
              :src="app.logo"
              class="app-logo"
              :class="tileClasses.img"
              alt=""
            />
            <span
              v-else
              class="app-logo grid place-items-center bg-portal-elevated font-mono text-sm font-semibold uppercase text-portal-signature"
              :class="tileClasses.img"
              aria-hidden="true"
              >{{ app.initials }}</span
            >
          </template>
          <div>
            <h3
              :data-initials="app.initials"
              class="app-label break-words"
              :class="tileClasses.title"
            >
              <a :href="app.url" class="">{{ app.label }}</a>
            </h3>
            <p
              v-if="
                app.description && settings.portal_tile_theme === 'descriptive'
              "
              class="app-description mt-1 text-sm leading-5 text-portal-muted"
              v-html="sanitizeHtml(app.description)"
            />
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.grid li a::after {
  content: '';
  position: absolute;
  top: 0px;
  left: 0px;
  right: 0px;
  bottom: 0px;
}

#app-tiles .app-logo {
  object-fit: contain;
}

#app-tiles.simple {
  grid-template-columns: repeat(auto-fill, 180px);
  grid-template-rows: repeat(auto-fill, minmax(180px, 1fr));
}

#app-tiles.periodic {
  grid-template-columns: repeat(auto-fill, 180px);
  grid-template-rows: repeat(auto-fill, 180px);
}

#app-tiles.simple .app-tile:hover,
#app-tiles.descriptive .app-tile:hover {
  background-color: rgb(var(--portal-selection));
}

#app-tiles.periodic .app-tile {
  min-height: 180px;
  border-radius: 3px;
  border: 1px solid rgb(var(--portal-border));
  background: rgb(var(--portal-surface));
}
#app-tiles.periodic .app-label:before {
  content: attr(data-initials);
  display: block;
  font-size: 5em;
  font-weight: 700;
  padding-top: 0.5em;
  padding-bottom: 0.3em;
  color: rgb(var(--portal-signature));
}

@media (max-width: 620px) {
  #app-tiles.simple,
  #app-tiles.periodic {
    grid-template-columns: repeat(auto-fill, calc(50vw - 2rem));
    grid-template-rows: repeat(auto-fill, calc(50vw - 2rem));
  }

  #app-tiles.periodic .app-tile {
    min-height: calc(50vw - 2rem);
  }
  #app-tiles.periodic .app-label:before {
    padding-top: 9vw;
    padding-bottom: 8vw;
  }
}
</style>
