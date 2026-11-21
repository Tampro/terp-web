"use client"

import { useCurrentUser } from "@/components/user-menu-content"
import { useAuthStore } from "@/lib/auth/auth.store"
import { useT } from "@/lib/i18n"

import { SuperAdminDashboard } from "./_components/super-admin-dashboard"

/** Landing page after login: the Super Admin dashboard (manual §3.1); company dashboards (§5) come later. */
export default function DashboardPage() {
  const t = useT()
  const user = useCurrentUser()
  const superAdmin = useAuthStore((s) => s.me?.superAdmin)
  if (superAdmin) return <SuperAdminDashboard />
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("dashboard.welcome", { name: user.name })}</h1>
    </div>
  )
}
