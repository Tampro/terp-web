"use client"

import * as React from "react"
import {
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  ClipboardCheck,
  Network,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users,
  Wallet,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMoney } from "@/hooks/use-money"
import {
  DashboardService,
  type CalendarView,
  type CompanyDashboard as TDashboard,
  type ECandidateStatus,
  type ELeaveStatus,
} from "@/lib/dashboard/dashboard.service"
import { formatDate, formatNumber } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { SectionCard, StatCard } from "./dashboard-kit"
import { UpcomingEvents, useUpcomingCalendar } from "./upcoming-events"

const MONTHS = Array.from({ length: 12 }, (_, i) => i)
const CANDIDATE_STATUSES: ECandidateStatus[] = ["NEW", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED"]
const LEAVE_VARIANT: Record<ELeaveStatus, "secondary" | "outline" | "destructive"> = {
  APPROVED: "secondary",
  PENDING: "outline",
  REJECTED: "destructive",
}

/**
 * §5 company dashboards with a backend today: HRM and Recruitment (GET /reports/dashboard?year=, one call; each card
 * carries its own error). Tabs follow the permissions; the server re-checks every card.
 */
export function CompanyDashboard({ hrm, recruitment }: { hrm: boolean; recruitment: boolean }) {
  const t = useT()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = React.useState(currentYear)
  const [tab, setTab] = React.useState(hrm ? "hrm" : "recruitment")
  const [state, setState] = React.useState<{ data?: TDashboard; error?: string; loading: boolean }>({ loading: true })
  const calendar = useUpcomingCalendar()

  React.useEffect(() => {
    let cancelled = false
    DashboardService.company(year)
      .then((data) => !cancelled && setState({ data, loading: false }))
      .catch((e: Error) => !cancelled && setState({ error: e.message, loading: false }))
    return () => {
      cancelled = true
    }
  }, [year])

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader title={t("menu.dashboard")} description={t("cdash.subtitle")}>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28" aria-label={t("dash.year")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[0, 1, 2, 3, 4].map((i) => (
              <SelectItem key={i} value={String(currentYear - i)}>
                {currentYear - i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        {hrm && recruitment && (
          <TabsList>
            <TabsTrigger value="hrm">{t("cdash.tabHrm")}</TabsTrigger>
            <TabsTrigger value="recruitment">{t("cdash.tabRecruitment")}</TabsTrigger>
          </TabsList>
        )}
        {hrm && (
          <TabsContent value="hrm">
            <HrmDashboard data={state.data} loading={state.loading} year={year} calendar={calendar} />
          </TabsContent>
        )}
        {recruitment && (
          <TabsContent value="recruitment">
            <RecruitmentDashboardView data={state.data} loading={state.loading} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function HrmDashboard({
  data,
  loading,
  year,
  calendar,
}: {
  data?: TDashboard
  loading: boolean
  year: number
  calendar: { data?: CalendarView; loading: boolean; error?: string }
}) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const money = useMoney()
  const n = (v: number | null | undefined) => formatNumber(v, language)
  const emp = data?.employees?.data
  const att = data?.attendance?.data
  const leave = data?.leave?.data
  const payroll = data?.payroll?.data

  // banner: today's attendance rate = present today / active employees
  const rate = att?.activeEmployees ? ((att.presentToday ?? 0) / att.activeEmployees) * 100 : null
  const monthLabel = (m: number) => new Date(2000, m, 1).toLocaleString(language, { month: "short" })
  const hiring = MONTHS.map((m) => ({ month: monthLabel(m), hires: emp?.hiringTrend?.[m] ?? 0 }))
  const week = (att?.last7Days ?? []).map((d) => ({
    day: d.date ? new Date(`${d.date}T00:00:00`).toLocaleDateString(language, { weekday: "short", day: "numeric" }) : "-",
    present: d.present ?? 0,
    onLeave: d.onLeave ?? 0,
    absent: d.absent ?? 0,
  }))
  const weekConfig = {
    present: { label: t("cdash.present"), color: "var(--chart-2)" },
    onLeave: { label: t("cdash.onLeave"), color: "var(--chart-4)" },
    absent: { label: t("cdash.absent"), color: "var(--destructive)" },
  } satisfies ChartConfig
  const hiringConfig = { hires: { label: t("cdash.newHires"), color: "var(--primary)" } } satisfies ChartConfig
  const maxDept = Math.max(1, ...(emp?.byDepartment ?? []).map((d) => d.employees ?? 0))

  return (
    <div className="mt-2 flex flex-col gap-4">
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm opacity-80">{t("cdash.attendanceToday")}</p>
            <p className="text-3xl font-semibold" data-testid="cdash.rateToday">
              {loading ? "…" : rate === null ? "-" : `${formatNumber(rate, language, 1)}%`}
            </p>
            <p className="text-sm opacity-80">
              {t("cdash.presentOf", { present: n(att?.presentToday), total: n(att?.activeEmployees) })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-80">{t("cdash.rateThisMonth")}</p>
            <p className="text-xl font-semibold">
              {att?.attendanceRateThisMonth == null ? "-" : `${formatNumber(att.attendanceRateThisMonth, language, 1)}%`}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("cdash.employees")}
          value={n(emp?.totalEmployees)}
          hint={t("cdash.newThisMonth", { n: n(emp?.newThisMonth) })}
          icon={Users}
          loading={loading}
          testId="cdash.employees"
        />
        <StatCard label={t("cdash.present")} value={n(att?.presentToday)} icon={UserCheck} loading={loading} testId="cdash.present" />
        <StatCard label={t("cdash.absent")} value={n(att?.absentToday)} icon={CalendarX} loading={loading} testId="cdash.absent" />
        <StatCard label={t("cdash.onLeave")} value={n(att?.onLeaveToday)} icon={CalendarClock} loading={loading} />
        <StatCard label={t("cdash.branches")} value={n(emp?.branches)} icon={Building2} loading={loading} />
        <StatCard label={t("cdash.departments")} value={n(emp?.departments)} icon={Network} loading={loading} />
        <StatCard
          label={t("cdash.promotions")}
          value={n(emp?.promotions)}
          hint={t("cdash.inYear", { year })}
          icon={TrendingUp}
          loading={loading}
        />
        <StatCard
          label={t("cdash.terminations")}
          value={n(emp?.terminations)}
          hint={t("cdash.inYear", { year })}
          icon={UserMinus}
          loading={loading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={t("cdash.last7Days")} part={data?.attendance} loading={loading} empty={!week.length}>
          <ChartContainer config={weekConfig} className="h-64 w-full">
            <BarChart data={week}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="present" stackId="a" fill="var(--color-present)" />
              <Bar dataKey="onLeave" stackId="a" fill="var(--color-onLeave)" />
              <Bar dataKey="absent" stackId="a" fill="var(--color-absent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </SectionCard>
        <SectionCard
          title={t("cdash.hiringTrend")}
          description={t("dash.byMonth", { year })}
          part={data?.employees}
          loading={loading}
        >
          <ChartContainer config={hiringConfig} className="h-64 w-full">
            <LineChart data={hiring}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line dataKey="hires" stroke="var(--color-hires)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title={t("cdash.byDepartment")}
          part={data?.employees}
          loading={loading}
          empty={!emp?.byDepartment?.length}
        >
          {emp?.byDepartment?.map((d) => (
            <div key={d.departmentId ?? "none"} className="grid gap-1 text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate">{d.name ?? t("cdash.noDepartment")}</span>
                <span className="text-muted-foreground shrink-0">{n(d.employees)}</span>
              </div>
              <div className="bg-muted h-2 rounded-full">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${((d.employees ?? 0) / maxDept) * 100}%` }} />
              </div>
            </div>
          ))}
        </SectionCard>

        <SectionCard title={t("cdash.missingAttendance")} part={data?.attendance} loading={loading}>
          <p className="text-3xl font-semibold" data-testid="cdash.notMarked">
            {n(att?.notMarkedToday)}
          </p>
          <p className="text-muted-foreground text-sm">{t("cdash.missingHint")}</p>
        </SectionCard>

        <SectionCard title={t("cdash.leaveToday")} part={data?.leave} loading={loading} empty={!leave?.todayLeaves?.length}>
          {leave?.todayLeaves?.map((l) => (
            <div key={l.applicationId} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium">{l.employee?.fullName ?? "-"}</span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {l.leaveType ?? "-"} · {formatDate(l.endDate, language)}
              </span>
            </div>
          ))}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title={t("cdash.recentLeaves")}
          description={
            leave?.month
              ? t("cdash.leaveMonth", { pending: n(leave.month.pending), approved: n(leave.month.approved), total: n(leave.month.total) })
              : undefined
          }
          part={data?.recentLeaves}
          loading={loading}
          empty={!data?.recentLeaves?.data?.length}
        >
          {data?.recentLeaves?.data?.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{l.employee?.fullName ?? "-"}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {l.leaveType?.name ?? "-"} · {formatDate(l.startDate, language)} – {formatDate(l.endDate, language)}
                </p>
              </div>
              {l.status && <Badge variant={LEAVE_VARIANT[l.status]}>{t(`cdash.leave.${l.status}` as TranslationKey)}</Badge>}
            </div>
          ))}
        </SectionCard>

        <SectionCard
          title={t("cdash.announcements")}
          part={data?.announcements}
          loading={loading}
          empty={!data?.announcements?.data?.length}
        >
          {data?.announcements?.data?.map((a) => (
            <div key={a.id} className="grid gap-0.5 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <span className="truncate">{a.title ?? "-"}</span>
                {a.highPriority && <Badge variant="destructive">{t("cdash.highPriority")}</Badge>}
              </p>
              <p className="text-muted-foreground text-xs">{formatDate(a.startDate, language)}</p>
            </div>
          ))}
        </SectionCard>

        <UpcomingEvents calendar={calendar} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={t("cdash.birthdays")} part={data?.employees} loading={loading} empty={!emp?.birthdaysToday?.length}>
          {emp?.birthdaysToday?.map((b) => (
            <div key={b.employeeId} className="flex justify-between gap-3 text-sm">
              <span className="truncate font-medium">{b.fullName ?? "-"}</span>
              <span className="text-muted-foreground shrink-0 text-xs">{b.designation ?? "-"}</span>
            </div>
          ))}
        </SectionCard>
        <SectionCard title={t("cdash.payroll")} part={data?.payroll} loading={loading}>
          <div className="flex items-center gap-3">
            <Wallet className="text-primary size-8" />
            <div>
              <p className="text-2xl font-semibold">{money(payroll?.thisMonthNet)}</p>
              <p className="text-muted-foreground text-xs">{t("cdash.lastMonth", { amount: money(payroll?.lastMonthNet) })}</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function RecruitmentDashboardView({ data, loading }: { data?: TDashboard; loading: boolean }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const n = (v: number | null | undefined) => formatNumber(v, language)
  const rec = data?.recruitment?.data
  const pipeline = CANDIDATE_STATUSES.map((s) => ({ stage: t(`cdash.cand.${s}` as TranslationKey), count: rec?.pipeline?.[s] ?? 0 }))
  const pipelineConfig = { count: { label: t("cdash.candidates"), color: "var(--primary)" } } satisfies ChartConfig

  return (
    <div className="mt-2 flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("cdash.activeJobs")}
          value={n(rec?.activeJobs)}
          hint={t("cdash.openPositions", { n: n(rec?.openPositions) })}
          icon={Briefcase}
          loading={loading}
          testId="cdash.activeJobs"
        />
        <StatCard label={t("cdash.candidates")} value={n(rec?.totalCandidates)} icon={Users} loading={loading} testId="cdash.candidates" />
        <StatCard label={t("cdash.interviews")} value={n(rec?.scheduledInterviews)} icon={CalendarCheck} loading={loading} />
        <StatCard label={t("cdash.onboardings")} value={n(rec?.completedOnboardings)} icon={ClipboardCheck} loading={loading} />
      </div>

      {!loading && !data?.recruitment?.error && (
        <p className="text-muted-foreground text-sm" data-testid="cdash.career">
          {rec?.careerSlug ? t("cdash.careerOn", { slug: rec.careerSlug }) : t("cdash.careerOff")}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={t("cdash.pipeline")} part={data?.recruitment} loading={loading}>
          <ChartContainer config={pipelineConfig} className="h-64 w-full">
            <BarChart data={pipeline}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="stage" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            </BarChart>
          </ChartContainer>
        </SectionCard>
        <SectionCard title={t("cdash.funnel")} part={data?.recruitment} loading={loading} empty={!rec?.funnel?.length}>
          {rec?.funnel?.map((f) => (
            <div key={f.stage} className="grid gap-1 text-sm">
              <div className="flex justify-between gap-2">
                <span>{f.stage ? t(`cdash.cand.${f.stage}` as TranslationKey) : "-"}</span>
                <span className="text-muted-foreground">
                  {n(f.reached)} · {formatNumber(f.percentOfTotal, language, 1)}%
                </span>
              </div>
              <div className="bg-muted h-2 rounded-full">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min(100, f.percentOfTotal ?? 0)}%` }} />
              </div>
            </div>
          ))}
        </SectionCard>
      </div>

      <SectionCard
        title={t("cdash.recentCandidates")}
        part={data?.recentCandidates}
        loading={loading}
        empty={!data?.recentCandidates?.data?.length}
      >
        {data?.recentCandidates?.data?.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{c.fullName ?? "-"}</p>
              <p className="text-muted-foreground truncate text-xs">
                {c.job?.title ?? "-"} · {formatDate(c.applicationDate, language)}
              </p>
            </div>
            {c.status && <Badge variant="outline">{t(`cdash.cand.${c.status}` as TranslationKey)}</Badge>}
          </div>
        ))}
      </SectionCard>
    </div>
  )
}
