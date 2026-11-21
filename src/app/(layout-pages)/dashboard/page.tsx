"use client"

import { useCurrentUser } from "@/components/user-menu-content"
import { useT } from "@/lib/i18n"

/** Landing page after login. The role dashboards (manual §5) come later. */
export default function DashboardPage() {
  const t = useT()
  const user = useCurrentUser()
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("dashboard.welcome", { name: user.name })}</h1>
    </div>
  )
}
