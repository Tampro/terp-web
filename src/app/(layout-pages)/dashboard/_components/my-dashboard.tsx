"use client"

import * as React from "react"
import Link from "next/link"
import { Award, CalendarClock, Handshake, Headset, IdCard, TriangleAlert, Users } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useMoney } from "@/hooks/use-money"
import { useAuthStore } from "@/lib/auth/auth.store"
import { MyDashboardService, type MyDashboard as TMyDashboard, type Part } from "@/lib/dashboard/dashboard.service"
import { formatDate, formatNumber } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { SectionCard, StatCard } from "./dashboard-kit"

/** errors meaning "this account has no employee profile in the company" (employee, attendance, recruitment service) */
const NO_PROFILE = ["EMP_001", "EMP_041", "ATT_060", "REC_069"]
const STATUS_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  APPROVED: "secondary",
  COMPLETED: "secondary",
  PENDING: "outline",
  SCHEDULED: "outline",
  REJECTED: "destructive",
  CANCELLED: "destructive",
}

/** A part is shown unless it is not meant for this user: no permission, no profile (said once), no source yet. */
const shown = (part?: Part<unknown>) => !!part && !["COMMON_004", "NOT_AVAILABLE", ...NO_PROFILE].includes(part.error ?? "")

const hhmm = (v?: string | null) => (v ? v.slice(0, 5) : "")

/**
 * §5 "my dashboard" (GET /reports/my-dashboard): the signed-in employee's own profile, shift, leave, warnings, awards,
 * interviews on my panel, own CRM deals and support tickets, my announcements. Parts the user may not see are left
 * out; a missing employee profile is said once.
 */
export function MyDashboard() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const money = useMoney()
  const permissions = useAuthStore((s) => s.me?.permissions)
  // "View all" only where the user may open the list page
  const may = (...codes: string[]) => codes.some((c) => permissions?.includes(c))
  const [state, setState] = React.useState<{ data?: TMyDashboard; error?: string }>({})
  React.useEffect(() => {
    let cancelled = false
    MyDashboardService.get()
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
  const p = data?.parts ?? {}
  const n = (v?: number) => formatNumber(v ?? 0, language)
  const status = (s?: string, prefix = "hr.status") =>
    s ? (
      <Badge variant={STATUS_VARIANT[s] ?? "outline"} className="shrink-0">
        {t(`${prefix}.${s}` as TranslationKey)}
      </Badge>
    ) : null
  const noProfile = NO_PROFILE.includes(p.myProfile?.error ?? "")
  const profile = p.myProfile?.data
  const shift = p.myShift?.data
  const balances = p.myLeaveBalances?.data ?? []
  const leave = p.myLeaveApplications?.data

  return (
    <div className="grid gap-4" data-testid="my-dashboard">
      {noProfile && (
        <Alert data-testid="my-no-profile">
          <AlertDescription>{t("my.noProfile")}</AlertDescription>
        </Alert>
      )}

      {(loading || profile) && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4" data-testid="my-profile">
            {profile?.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- media link from the employee service
              <img src={profile.profileImageUrl} alt="" className="size-14 rounded-full object-cover" />
            ) : (
              <span className="bg-muted grid size-14 place-items-center rounded-full">
                <IdCard className="text-muted-foreground size-6" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">{loading ? "…" : (profile?.fullName ?? "-")}</p>
              <p className="text-muted-foreground truncate text-sm">
                {[profile?.employeeNo, profile?.designation?.name, profile?.department?.name, profile?.branch?.name].filter(Boolean).join(" · ")}
              </p>
            </div>
            {shown(p.myShift) && (
              <div className="text-right text-sm" data-testid="my-shift">
                <p className="text-muted-foreground">{t("my.shiftToday")}</p>
                <p className="font-medium">
                  {shift ? `${shift.name ?? "-"} · ${hhmm(shift.startTime)}–${hhmm(shift.endTime)}` : t("my.noShift")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {shown(p.myLeaveApplications) && (
          <StatCard label={t("my.pendingLeaves")} value={n(leave?.pendingApplications)} icon={CalendarClock} loading={loading} testId="my-pending-leaves" />
        )}
        {shown(p.myInterviews) && (
          <StatCard label={t("my.interviews")} value={n(p.myInterviews?.data?.length)} icon={Users} loading={loading} />
        )}
        {shown(p.myDeals) && (
          <StatCard label={t("my.deals")} value={n(p.myDeals?.data?.deals)} icon={Handshake} loading={loading} testId="my-deals" />
        )}
        {shown(p.myTickets) && (
          <StatCard
            label={t("my.tickets")}
            value={n(p.myTickets?.data?.open)}
            hint={t("my.ticketsHint", { total: n(p.myTickets?.data?.total), closed: n(p.myTickets?.data?.closed) })}
            icon={Headset}
            loading={loading}
            testId="my-tickets"
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {shown(p.myLeaveBalances) && (
          <SectionCard title={t("my.leaveBalances")} part={p.myLeaveBalances} loading={loading} empty={!balances.length}>
            <ul className="grid gap-2" data-testid="my-balances">
              {balances.map((b) => (
                <li key={b.leaveType?.id} className="grid gap-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="truncate">{b.leaveType?.name ?? "-"}</span>
                    <span className="text-muted-foreground shrink-0">{t("my.daysLeft", { available: n(b.available), total: n(b.total) })}</span>
                  </div>
                  <div className="bg-muted h-2 rounded-full">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${b.total ? Math.min(100, ((b.available ?? 0) / b.total) * 100) : 0}%`,
                        background: b.leaveType?.color ?? "var(--primary)",
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {shown(p.myLeaveApplications) && (
          <SectionCard title={t("my.leaveApplications")} href={may("LEAVE_VIEW") ? "/hrm/leave" : undefined} part={p.myLeaveApplications} loading={loading} empty={!leave?.recentApplications?.length}>
            {leave?.recentApplications?.map((a) => (
              <div key={a.id} className="flex min-w-0 items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.leaveType?.name ?? "-"}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {formatDate(a.startDate, language)} – {formatDate(a.endDate, language)} · {t("my.days", { n: n(a.totalDays) })}
                  </p>
                </div>
                {status(a.status)}
              </div>
            ))}
          </SectionCard>
        )}

        {shown(p.myAnnouncements) && (
          <SectionCard title={t("cdash.myAnnouncements")} part={p.myAnnouncements} loading={loading} empty={!p.myAnnouncements?.data?.length}>
            {p.myAnnouncements?.data?.map((a) => (
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
        )}

        {shown(p.myInterviews) && (
          <SectionCard title={t("my.upcomingInterviews")} href={may("RECRUITMENT_VIEW") ? "/recruitment/interviews" : undefined} part={p.myInterviews} loading={loading} empty={!p.myInterviews?.data?.length}>
            {p.myInterviews?.data?.map((i) => (
              <div key={i.id} className="flex min-w-0 items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{i.candidate?.fullName ?? "-"}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {[`${formatDate(i.date, language)} ${hhmm(i.startTime)}`, i.round?.name, i.candidate?.jobTitle].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {status(i.status, "my.interview")}
              </div>
            ))}
          </SectionCard>
        )}

        {shown(p.myWarnings) && (
          <SectionCard title={t("my.warnings")} part={p.myWarnings} loading={loading} empty={!p.myWarnings?.data?.length}>
            {p.myWarnings?.data?.map((w) => (
              <div key={w.id} className="flex min-w-0 items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <TriangleAlert className="text-destructive size-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{w.subject ?? w.warningType?.name ?? "-"}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {[formatDate(w.warningDate, language), w.severity?.name].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                {status(w.status)}
              </div>
            ))}
          </SectionCard>
        )}

        {shown(p.myAwards) && (
          <SectionCard title={t("my.awards")} part={p.myAwards} loading={loading} empty={!p.myAwards?.data?.length}>
            {p.myAwards?.data?.map((a) => (
              <div key={a.id} className="flex min-w-0 items-center gap-2 text-sm">
                <Award className="text-primary size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.awardType?.name ?? "-"}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {[formatDate(a.awardDate, language), a.gift].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
            ))}
          </SectionCard>
        )}

        {shown(p.myDeals) && (
          <SectionCard title={t("my.recentDeals")} href={may("CRM_VIEW", "CRM_VIEW_OWN") ? "/crm/deals" : undefined} part={p.myDeals} loading={loading} empty={!p.myDeals?.data?.recentDeals?.length}>
            {p.myDeals?.data?.recentDeals?.map((d) => (
              <Link key={d.id} href={`/crm/deals/${d.id}`} className="hover:bg-muted/50 -mx-2 flex min-w-0 items-center justify-between gap-3 rounded-md px-2 py-1 text-sm">
                <span className="truncate font-medium">{d.name ?? "-"}</span>
                <span className="text-muted-foreground shrink-0 text-xs">{money(d.price)}</span>
              </Link>
            ))}
          </SectionCard>
        )}
      </div>
    </div>
  )
}
