"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { Spinner } from "@/components/ui/spinner"
import { useAuthStore } from "@/lib/auth/auth.store"

/** Pages inside the admin layout need a token; without one the user goes to /login?redirect=<page>. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { status, load } = useAuthStore()

  React.useEffect(() => {
    if (status === "idle") void load()
  }, [status, load])

  React.useEffect(() => {
    if (status === "anonymous") router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
  }, [status, pathname, router])

  if (status !== "ready") {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    )
  }
  return <>{children}</>
}
