"use client"

import { PageHeader } from "@/components/common/page-header"
import { useCurrentUser } from "@/components/user-menu-content"
import { useAuthStore } from "@/lib/auth/auth.store"
import { useT } from "@/lib/i18n"

import { ClockCard } from "./clock-card"
import { MyDashboard } from "./my-dashboard"
import { UpcomingEvents, useUpcomingCalendar } from "./upcoming-events"

/**
 * §5 role view for a user without HRM / Recruitment / module dashboard rights (Staff): Clock In / Clock Out of today
 * (ATTENDANCE_SELF, GET/POST /attendance/me/*), my dashboard (GET /reports/my-dashboard) and the calendar kinds I may
 * see (GET /reports/calendar).
 */
export function StaffDashboard() {
  const t = useT()
  const user = useCurrentUser()
  const selfService = !!useAuthStore((s) => s.me?.permissions)?.includes("ATTENDANCE_SELF")
  const calendar = useUpcomingCalendar()

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader title={t("dashboard.welcome", { name: user.name })} description={t("cdash.staffSubtitle")} />
      {selfService && <ClockCard />}
      <MyDashboard />
      <div className="grid gap-4 lg:grid-cols-2">
        <UpcomingEvents calendar={calendar} />
      </div>
    </div>
  )
}
