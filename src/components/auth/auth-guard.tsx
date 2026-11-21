"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { Spinner } from "@/components/ui/spinner"
import { tokenStore } from "@/lib/api"
import { useAuthStore } from "@/lib/auth/auth.store"

/** Pages inside the admin layout need a token; without one the user goes to /login?redirect=<page>. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { status, load } = useAuthStore()

  // "anonymous" from an earlier visit is stale once a login stored tokens (E2E AUTH-007): load the user again.
  const hasToken = typeof window !== "undefined" && !!tokenStore.access
  const shouldLoad = status === "idle" || (status === "anonymous" && hasToken)

  React.useEffect(() => {
    if (shouldLoad) void load()
  }, [shouldLoad, load])

  React.useEffect(() => {
    if (status === "anonymous" && !hasToken) router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
  }, [status, hasToken, pathname, router])

  if (status !== "ready") {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    )
  }
  return <>{children}</>
}
