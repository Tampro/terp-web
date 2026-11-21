"use client"

import { ShieldAlert } from "lucide-react"

import { useAuthStore } from "@/lib/auth/auth.store"
import { useT } from "@/lib/i18n"

/** Super Admin pages: others see a "no permission" message. The backend re-checks (@PermissionChecker.isSuperAdmin). */
export function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const t = useT()
  const superAdmin = useAuthStore((s) => s.me?.superAdmin)
  if (!superAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
        <ShieldAlert className="text-muted-foreground size-10" />
        <h1 className="text-lg font-semibold">{t("common.noPermission")}</h1>
        <p className="text-muted-foreground text-sm">{t("common.noPermissionDesc")}</p>
      </div>
    )
  }
  return <>{children}</>
}
