import type { FetchError } from 'ofetch'

// `suffix` defaults to the portal API path, but callers that need a
// different backend on the same host (e.g. the native `/package` API used
// by my-site.vue's Blossom/nsite endpoints) can override it while still
// getting the dev-mode `apiIp` override below.
export const useApiEndpoint = (suffix: string = '/nostrhost/portalapi') => {
  return (
    'https://' +
    (process.dev
      ? useRuntimeConfig().public.apiIp || window.location.host
      : window.location.host) +
    suffix
  )
}

export function useApi<T>(
  path: string,
  {
    method = 'GET',
    body = undefined,
  }: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: Record<string, any>
  } = {},
) {
  type Resp = {
    data: Ref<T | null>
    error: Ref<FetchError | null>
  }
  const result: Resp = {
    data: ref(null),
    error: ref(null),
  }

  const query = () => {
    return $fetch(useApiEndpoint() + path, {
      method,
      credentials: 'include',
      body,
    })
      .then((data) => {
        result.data.value = data as T
      })
      .catch(async (e: FetchError) => {
        result.error.value = e
        if (e.statusCode === 401) {
          useIsLoggedIn().value = false
          const route = useRoute()
          const settings = await useSettings()
          if (!(settings.value.public && route.meta.public)) {
            navigateTo('/login')
          }
        } else if (
          e.statusCode !== 400 &&
          e.statusCode !== 404 &&
          !e.data?.path
        ) {
          throw createError({
            statusCode: e.statusCode,
            statusMessage: e.message,
            fatal: true,
          })
        }
      })
  }
  return Promise.resolve(query()).then(() => result)
}
