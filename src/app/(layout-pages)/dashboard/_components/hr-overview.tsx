"use client"

import * as React from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { HrDashboardService, type HrDashboard } from "@/lib/dashboard/dashboard.service"
import { formatDate, formatNumber } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { SectionCard } from "./dashboard-kit"

const STATUS_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  APPROVED: "secondary",
  PENDING: "outline",
  REJECTED: "destructive",
}

/**
 * The parts of GET /reports/hr-dashboard that /reports/dashboard does not have: employees by branch, the latest
 * promotions and terminations, approved company events of the next 30 days. Mounted only while the HRM tab is shown.
 */
export function HrOverview() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const [state, setState] = React.useState<{ data?: HrDashboard; error?: string }>({})
  React.useEffect(() => {
    let cancelled = false
    HrDashboardService.get()
      .then((data) => !cancelled && setState({ data }))
      .catch((e: Error) => !cancelled && setState({ error: e.message }))
    return () => {
      cancelled = true
    }
  }, [])
  const { data, error } = state
  const loading = !data && !error
  if (error)
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  const n = (v?: number) => formatNumber(v ?? 0, language)
  const status = (s?: string) =>
    s ? (
      <Badge variant={STATUS_VARIANT[s] ?? "outline"} className="shrink-0">
        {t(`hr.status.${s}` as TranslationKey)}
      </Badge>
    ) : null
  const branches = data?.employeesByBranch?.data ?? []
  const maxBranch = Math.max(1, ...branches.map((b) => b.employees ?? 0))

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="hr-overview">
      <SectionCard title={t("cdash.byBranch")} part={data?.employeesByBranch} loading={loading} empty={!branches.length}>
        <ul className="grid gap-2" data-testid="hr-branches">
          {branches.map((b) => (
            <li key={b.branchId} className="grid gap-1 text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate">{b.name ?? "-"}</span>
                <span className="text-muted-foreground shrink-0">{n(b.employees)}</span>
              </div>
              <div className="bg-muted h-2 rounded-full">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${((b.employees ?? 0) / maxBranch) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title={t("cdash.recentPromotions")}
        href="/hrm/recognition"
        part={data?.recentPromotions}
        loading={loading}
        empty={!data?.recentPromotions?.data?.length}
      >
        {data?.recentPromotions?.data?.map((p) => (
          <div key={p.id} className="flex min-w-0 items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{p.employee?.fullName ?? "-"}</p>
              <p className="text-muted-foreground truncate text-xs">
                {p.newDesignation?.name ?? "-"} · {formatDate(p.promotionDate, language)}
              </p>
            </div>
            {status(p.status)}
          </div>
        ))}
      </SectionCard>

      <SectionCard
        title={t("cdash.recentTerminations")}
        href="/hrm/career"
        part={data?.recentTerminations}
        loading={loading}
        empty={!data?.recentTerminations?.data?.length}
      >
        {data?.recentTerminations?.data?.map((r) => (
          <div key={r.id} className="flex min-w-0 items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{r.employee?.fullName ?? "-"}</p>
              <p className="text-muted-foreground truncate text-xs">
                {r.terminationType?.name ?? "-"} · {formatDate(r.terminationDate, language)}
              </p>
            </div>
            {status(r.status)}
          </div>
        ))}
      </SectionCard>

      <SectionCard
        title={t("cdash.companyEvents")}
        description={t("cdash.next30Days")}
        href="/hrm/events"
        part={data?.upcomingEvents}
        loading={loading}
        empty={!data?.upcomingEvents?.data?.length}
      >
        <ul className="grid min-w-0 gap-2" data-testid="hr-events">
          {data?.upcomingEvents?.data?.map((e) => (
            <li key={e.id} className="flex min-w-0 items-start gap-2 text-sm">
              <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: e.color ?? "var(--primary)" }} />
              <div className="min-w-0">
                <p className="truncate font-medium">{e.title ?? "-"}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {[
                    formatDate(e.startDate, language) + (e.startTime ? ` ${e.startTime.slice(0, 5)}` : ""),
                    e.eventType?.name,
                    e.location,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}
