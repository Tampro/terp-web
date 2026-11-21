"use client"

import * as React from "react"
import { LogOut } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { actAsStore } from "@/lib/api"
import { CompanyService } from "@/lib/admin/admin.service"
import { useT } from "@/lib/i18n"

const noopSubscribe = () => () => {}

/** Shown while the super admin acts as a company ("Login As"); ends the session and reloads as super admin. */
export function ActAsBanner() {
  const t = useT()
  // Read once after hydration (sessionStorage is browser-only); strings keep the snapshot stable.
  const companyName = React.useSyncExternalStore(
    noopSubscribe,
    () => {
      const s = actAsStore.get()
      return s ? (s.companyName ?? s.companyId ?? "?") : ""
    },
    () => ""
  )
  const [ending, setEnding] = React.useState(false)
  if (!companyName) return null

  async function end() {
    setEnding(true)
    const s = actAsStore.get()
    try {
      if (s) await CompanyService.endImpersonation(s.sessionKey) // always 200 on the backend
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      actAsStore.clear()
      window.location.assign("/companies")
    }
  }

  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 bg-amber-500/15 px-4 py-2 text-sm">
      <span>{t("actAs.banner", { name: companyName })}</span>
      <Button size="sm" variant="outline" onClick={end} disabled={ending}>
        <LogOut className="size-4" /> {t("actAs.back")}
      </Button>
    </div>
  )
}
