import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { watch } from 'vue'
import type { FetchError } from 'ofetch'

// A2 server-state for the portal. `useApiQuery` is the query-backed sibling of
// the legacy `useApi`: reads are cached, cancellable and invalidatable, and a
// mutation in the same key domain can `queryClient.invalidateQueries` to
// refresh instead of fetching once and caching forever. The 401 and fatal
// error handling is preserved from `useApi`.
export function useApiQuery<T>(
  key: () => unknown[],
  path: string,
  options?: {
    enabled?: boolean
    staleTime?: number
    refetchInterval?: number | false
  },
) {
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error, refetch } = useQuery<T, FetchError>({
    queryKey: key(),
    queryFn: () =>
      $fetch<T>(useApiEndpoint() + path, {
        credentials: 'include',
      }),
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 5_000,
    refetchInterval: options?.refetchInterval ?? false,
    retry: 1,
  })

  // Error mapping identical to the legacy useApi: 401 -> sign-out; fatal
  // otherwise (callers that read `error` keep behaving the same).
  watch(error, (e) => {
    if (!e) return
    if (e.statusCode === 401) {
      useIsLoggedIn().value = false
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

  return { data, loading: isLoading, isError, error, refetch, queryClient }
}