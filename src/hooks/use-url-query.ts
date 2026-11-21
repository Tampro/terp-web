"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

/**
 * List filters in the URL. `update` merges a patch into the query; "", undefined, "ALL" and page 0 are removed.
 * Updates build on a ref, not on this render's searchParams: router.replace commits later, so two quick updates
 * (pick a filter, then search) would otherwise lose the first one (E2E LH-001).
 */
export function useUrlQuery() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const latest = React.useRef(searchParams.toString())

  React.useEffect(() => {
    latest.current = searchParams.toString()
  }, [searchParams])

  const update = React.useCallback(
    (patch: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(latest.current)
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "" || v === "ALL" || (k === "page" && v === 0)) next.delete(k)
        else next.set(k, String(v))
      }
      latest.current = next.toString()
      router.replace(latest.current ? `${pathname}?${latest.current}` : pathname)
    },
    [pathname, router]
  )

  const reset = React.useCallback(() => {
    latest.current = ""
    router.replace(pathname)
  }, [pathname, router])

  return { searchParams, update, reset }
}
