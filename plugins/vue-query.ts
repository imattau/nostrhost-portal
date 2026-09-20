import { VueQueryPlugin } from '@tanstack/vue-query'

// A2 server-state for the portal: reads/mutations go through Vue Query so the
// once-fetched settings/user data can be invalidated after a mutation instead
// of being cached forever. Automatic mutation retries are disabled.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(VueQueryPlugin, {
    queryClientConfig: {
      defaultOptions: {
        queries: {
          retry: 1,
          staleTime: 5_000,
        },
        mutations: {
          retry: 0,
        },
      },
    },
  })
})