"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { DashboardService, type CalendarView, type ECalendarKind } from "@/lib/dashboard/dashboard.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { SectionCard } from "./dashboard-kit"

const DAYS_AHEAD = 30 // GET /reports/calendar allows at most 62 days

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Next 30 days of meetings, holidays, leaves and birthdays the user may see (GET /reports/calendar). */
export function useUpcomingCalendar() {
  const [state, setState] = React.useState<{ data?: CalendarView; error?: string; loading: boolean }>({ loading: true })
  React.useEffect(() => {
    let cancelled = false
    const from = new Date()
    const to = new Date(from)
    to.setDate(to.getDate() + DAYS_AHEAD)
    DashboardService.calendar(isoDate(from), isoDate(to))
      .then((data) => !cancelled && setState({ data, loading: false }))
      .catch((e: Error) => !cancelled && setState({ error: e.message, loading: false }))
    return () => {
      cancelled = true
    }
  }, [])
  return state
}

const KIND_VARIANT: Record<ECalendarKind, "default" | "secondary" | "outline"> = {
  HOLIDAY: "default",
  MEETING: "secondary",
  LEAVE: "outline",
  BIRTHDAY: "outline",
}

export function UpcomingEvents({ calendar }: { calendar: { data?: CalendarView; loading: boolean; error?: string } }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const events = calendar.data?.upcoming ?? []
  return (
    <SectionCard
      title={t("cdash.events")}
      description={t("cdash.eventsHint")}
      loading={calendar.loading}
      part={calendar.error ? { error: "UNAVAILABLE" } : undefined}
      empty={!events.length}
    >
      {events.map((e) => (
        <div key={`${e.kind}-${e.id}-${e.start}`} className="flex items-center justify-between gap-3 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">{e.title ?? "-"}</p>
            <p className="text-muted-foreground text-xs">
              {formatDate(e.start, language)}
              {e.end && e.end !== e.start ? ` – ${formatDate(e.end, language)}` : ""}
              {e.startTime ? ` · ${e.startTime.slice(0, 5)}` : ""}
            </p>
          </div>
          {e.kind && <Badge variant={KIND_VARIANT[e.kind]}>{t(`cdash.kind.${e.kind}` as TranslationKey)}</Badge>}
        </div>
      ))}
    </SectionCard>
  )
}
