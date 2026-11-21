"use client"

import * as React from "react"
import { Info } from "lucide-react"

import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useCurrentUser } from "@/components/user-menu-content"
import { DashboardService, type AnnouncementRow, type Part } from "@/lib/dashboard/dashboard.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"

import { SectionCard } from "./dashboard-kit"
import { UpcomingEvents, useUpcomingCalendar } from "./upcoming-events"

/**
 * §5 role view for a user without HRM / Recruitment rights (Staff). Only what the backend serves to every signed-in
 * user: my announcements (GET /org/announcements/my) and the calendar kinds I may see (GET /reports/calendar).
 * Clock In and the user's own attendance/leave need a self-service API the backend does not have yet.
 */
export function StaffDashboard() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const user = useCurrentUser()
  const calendar = useUpcomingCalendar()
  const [news, setNews] = React.useState<{ part: Part<AnnouncementRow[]>; message?: string; loading: boolean }>({
    part: {},
    loading: true,
  })

  React.useEffect(() => {
    let cancelled = false
    DashboardService.myAnnouncements()
      .then((page) => !cancelled && setNews({ part: { data: page.content ?? [] }, loading: false }))
      // e.g. 403 EMP_041 "no employee profile in this company": show the backend's (localized) message
      .catch((e: Error) => !cancelled && setNews({ part: {}, message: e.message, loading: false }))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader title={t("dashboard.welcome", { name: user.name })} description={t("cdash.staffSubtitle")} />
      <Alert>
        <Info />
        <AlertDescription>{t("cdash.selfServiceSoon")}</AlertDescription>
      </Alert>
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title={t("cdash.myAnnouncements")}
          part={news.part}
          loading={news.loading}
          empty={!news.message && !news.part.data?.length}
        >
          {news.message && (
            <p className="text-muted-foreground text-sm" role="note">
              {news.message}
            </p>
          )}
          {news.part.data?.map((a) => (
            <div key={a.id} className="grid gap-0.5 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <span className="truncate">{a.title ?? "-"}</span>
                {a.highPriority && <Badge variant="destructive">{t("cdash.highPriority")}</Badge>}
              </p>
              {a.shortDescription && <p className="text-muted-foreground line-clamp-2 text-xs">{a.shortDescription}</p>}
              <p className="text-muted-foreground text-xs">{formatDate(a.startDate, language)}</p>
            </div>
          ))}
        </SectionCard>
        <UpcomingEvents calendar={calendar} />
      </div>
    </div>
  )
}
