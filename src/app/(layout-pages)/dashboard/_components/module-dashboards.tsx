"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Bug, Building2, CalendarClock, CheckCircle2, CircleDollarSign, Clock, FolderKanban, Handshake, Headset, LibraryBig, MessageCircleQuestion, Package, PackageX, Phone, Receipt, ShoppingCart, Ticket, Truck, UserRoundSearch, Users, Wallet } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { useMoney } from "@/hooks/use-money"
import { AccessService } from "@/lib/company/company.service"
import { ModuleDashboardService as M, type ModuleDashboard, type Part } from "@/lib/dashboard/dashboard.service"
import { formatDate, formatNumber } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { SectionCard, StatCard } from "./dashboard-kit"

export type DashboardModule = "project" | "account" | "pos" | "crm" | "support"

/** Loads one module dashboard for the year; the request runs only while its tab is shown (the component is mounted). */
function useModule<P>(load: (year: number) => Promise<ModuleDashboard<P>>, year: number) {
  const [state, setState] = React.useState<{ year?: number; data?: ModuleDashboard<P>; error?: string }>({})
  React.useEffect(() => {
    let cancelled = false
    load(year)
      .then((data) => !cancelled && setState({ year, data }))
      .catch((e: Error) => !cancelled && setState({ year, error: e.message }))
    return () => {
      cancelled = true
    }
    // load is a module-level service call
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])
  const current = state.year === year ? state : {}
  return { parts: current.data?.parts, error: current.error, loading: !current.data && !current.error }
}

function useMonths() {
  const language = useLanguageStore((s) => s.language)
  return (m?: number) => new Date(2000, (m ?? 1) - 1, 1).toLocaleString(language, { month: "short" })
}

/** A part that failed (no permission, service down) shows its reason instead of the cards. */
function PartGuard<T>({ part, loading, children }: { part?: Part<T>; loading: boolean; children: (data: T) => React.ReactNode }) {
  if (loading) return <>{children({} as T)}</>
  if (part?.error) return <SectionCard title="" part={part as Part<unknown>} />
  return <>{children((part?.data ?? {}) as T)}</>
}

function ScopeNote({ scope }: { scope?: string }) {
  const t = useT()
  return scope === "OWN" ? (
    <Alert>
      <AlertDescription>{t("mdash.scopeOwn")}</AlertDescription>
    </Alert>
  ) : null
}

const grid4 = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4"

// ------------------------------------------------------------------ 5.1 Project

/** user id → name for the team list (IAM_USER_VIEW; without it the id is shown) */
function useUserNames() {
  const [names, setNames] = React.useState<Record<string, string>>({})
  React.useEffect(() => {
    let cancelled = false
    AccessService.users({ size: 200 })
      .then((p) => !cancelled && setNames(Object.fromEntries((p.content ?? []).map((u) => [String(u.id), u.fullName || u.username || String(u.id)]))))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])
  return names
}

export function ProjectDashboard({ year }: { year: number }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const month = useMonths()
  const names = useUserNames()
  const { parts, error, loading } = useModule(M.project, year)
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  const n = (v?: number) => formatNumber(v ?? 0, language)
  return (
    <PartGuard part={parts?.stats} loading={loading}>
      {(s) => {
        const series = (s.monthly ?? []).map((x) => ({ month: month(x.month), created: x.created ?? 0, completed: x.completed ?? 0 }))
        const cfg = { created: { label: t("mdash.tasksCreated"), color: "var(--chart-1)" }, completed: { label: t("mdash.tasksCompleted"), color: "var(--chart-2)" } } satisfies ChartConfig
        return (
          <div className="grid gap-4">
            <ScopeNote scope={s.scope} />
            <div className={grid4}>
              <StatCard label={t("mdash.taskCompletion")} value={`${n(s.taskCompletionPercent)}%`} hint={t("mdash.tasksOf", { done: n(s.completedTasks), total: n(s.totalTasks) })} icon={CheckCircle2} loading={loading} testId="mdash-project-completion" />
              <StatCard label={t("mdash.projects")} value={n(s.totalProjects)} hint={t("mdash.overdue", { n: n(s.overdueProjects) })} icon={FolderKanban} loading={loading} />
              <StatCard label={t("mdash.activeBugs")} value={n(s.activeBugs)} icon={Bug} loading={loading} />
              <StatCard label={t("mdash.team")} value={n(s.teamSize)} hint={t("mdash.clientsN", { n: n(s.clients) })} icon={Users} loading={loading} />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SectionCard title={t("mdash.tasksByMonth")} description={t("dash.byMonth", { year })} href="/projects" loading={loading}>
                  <ChartContainer config={cfg} className="h-64 w-full">
                    <BarChart data={series}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="created" fill="var(--color-created)" radius={4} />
                      <Bar dataKey="completed" fill="var(--color-completed)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                </SectionCard>
              </div>
              <div className="grid gap-4">
                <SectionCard title={t("mdash.byStatus")} loading={loading}>
                  <Split values={s.byStatus} label={(k) => t(`project.status.${k}` as TranslationKey)} />
                </SectionCard>
                <SectionCard title={t("mdash.byPriority")} loading={loading}>
                  <Split values={s.byPriority} label={(k) => t(`mdash.priority.${k}` as TranslationKey)} />
                </SectionCard>
              </div>
            </div>
            <SectionCard title={t("mdash.teamPerformance")} loading={loading} empty={!s.teamPerformance?.length}>
              <ul className="grid gap-2" data-testid="mdash-team">
                {s.teamPerformance?.map((m) => (
                  <li key={m.userId} className="grid gap-1 text-sm">
                    <div className="flex justify-between">
                      <span>{names[String(m.userId)] ?? t("mdash.member", { id: m.userId ?? "-" })}</span>
                      <span className="text-muted-foreground">{t("mdash.tasksOf", { done: n(m.done), total: n(m.assigned) })}</span>
                    </div>
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                      <div className="bg-primary h-full" style={{ width: `${Math.min(100, m.progress ?? 0)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>
        )
      }}
    </PartGuard>
  )
}

/** A status / priority split as bars with counts and shares. */
function Split({ values, label }: { values?: Record<string, number>; label: (k: string) => string }) {
  const language = useLanguageStore((s) => s.language)
  const entries = Object.entries(values ?? {})
  const total = entries.reduce((a, [, v]) => a + (v ?? 0), 0)
  return (
    <ul className="grid gap-2 text-sm">
      {entries.map(([k, v]) => (
        <li key={k} className="grid gap-1">
          <div className="flex justify-between">
            <span>{label(k)}</span>
            <span className="font-medium">
              {formatNumber(v, language)}
              {total > 0 && <span className="text-muted-foreground ml-1 text-xs">({Math.round((v / total) * 100)}%)</span>}
            </span>
          </div>
          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
            <div className="bg-primary h-full" style={{ width: total ? `${(v / total) * 100}%` : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

// ------------------------------------------------------------------ 5.2 Account

export function AccountDashboard({ year }: { year: number }) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const month = useMonths()
  const { parts, error, loading } = useModule(M.account, year)
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  return (
    <PartGuard part={parts?.stats} loading={loading}>
      {(s) => {
        const series = (s.monthly ?? []).map((x) => ({ month: month(x.month), moneyIn: x.moneyIn ?? 0, moneyOut: x.moneyOut ?? 0 }))
        const cfg = { moneyIn: { label: t("mdash.moneyIn"), color: "var(--chart-2)" }, moneyOut: { label: t("mdash.moneyOut"), color: "var(--chart-5)" } } satisfies ChartConfig
        const list = (rows: typeof s.recentRevenues, href: string) =>
          rows?.map((r) => (
            <Link key={r.id} href={href} className="flex items-center justify-between gap-3 text-sm hover:underline">
              <span className="min-w-0">
                <span className="font-mono text-xs">{r.number}</span>
                <span className="text-muted-foreground ml-2 text-xs">{formatDate(r.date, language)}</span>
              </span>
              <span className="shrink-0 font-medium">{money(r.amount ?? 0)}</span>
            </Link>
          ))
        return (
          <div className="grid gap-4">
            <div className={grid4}>
              <StatCard label={t("mdash.netCashFlow")} value={money(s.netCashFlow ?? 0)} icon={Wallet} loading={loading} testId="mdash-net-cash" />
              <StatCard label={t("mdash.totalRevenue")} value={money(s.totalRevenue ?? 0)} icon={ArrowUpCircle} loading={loading} />
              <StatCard label={t("mdash.totalExpense")} value={money(s.totalExpense ?? 0)} icon={ArrowDownCircle} loading={loading} />
              <StatCard label={t("mdash.customerPayments")} value={money(s.customerPayments ?? 0)} hint={t("mdash.vendorPaymentsHint", { amount: money(s.vendorPayments ?? 0) })} icon={CircleDollarSign} loading={loading} />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SectionCard title={t("mdash.cashByMonth")} description={t("dash.byMonth", { year })} loading={loading}>
                  <ChartContainer config={cfg} className="h-64 w-full">
                    <LineChart data={series}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={64} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line dataKey="moneyIn" stroke="var(--color-moneyIn)" strokeWidth={2} dot={false} />
                      <Line dataKey="moneyOut" stroke="var(--color-moneyOut)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                </SectionCard>
              </div>
              <div className="grid gap-4">
                <StatCard label={t("mdash.clients")} value={formatNumber(s.clients ?? 0, language)} icon={Building2} loading={loading} />
                <StatCard label={t("mdash.vendors")} value={formatNumber(s.vendors ?? 0, language)} icon={Truck} loading={loading} />
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title={t("mdash.recentRevenues")} href="/accounting/revenues" loading={loading} empty={!s.recentRevenues?.length}>
                {list(s.recentRevenues, "/accounting/revenues")}
              </SectionCard>
              <SectionCard title={t("mdash.recentExpenses")} href="/accounting/expenses" loading={loading} empty={!s.recentExpenses?.length}>
                {list(s.recentExpenses, "/accounting/expenses")}
              </SectionCard>
            </div>
          </div>
        )
      }}
    </PartGuard>
  )
}

// ------------------------------------------------------------------ 5.5 POS

export function PosDashboard({ year }: { year: number }) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const month = useMonths()
  const { parts, error, loading } = useModule(M.pos, year)
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  const stock = parts?.stock?.data
  return (
    <div className="grid gap-4">
      <PartGuard part={parts?.sales} loading={loading}>
        {(s) => {
          const series = (s.monthly ?? []).map((x) => ({ month: month(x.month), orders: x.orders ?? 0 }))
          const cfg = { orders: { label: t("mdash.orders"), color: "var(--chart-1)" } } satisfies ChartConfig
          return (
            <>
              <div className={grid4}>
                <StatCard label={t("mdash.todaySales")} value={money(s.todayRevenue ?? 0)} hint={t("mdash.ordersN", { n: formatNumber(s.todayOrders ?? 0, language) })} icon={Receipt} loading={loading} testId="mdash-pos-today" />
                <StatCard label={t("mdash.totalSales")} value={money(s.totalRevenue ?? 0)} hint={t("mdash.ordersN", { n: formatNumber(s.totalOrders ?? 0, language) })} icon={ShoppingCart} loading={loading} />
                <StatCard label={t("mdash.averageTransaction")} value={money(s.averageTransaction ?? 0)} icon={CircleDollarSign} loading={loading} />
                <StatCard label={t("mdash.products")} value={formatNumber(stock?.products ?? 0, language)} hint={t("mdash.outOfStockN", { n: formatNumber(stock?.outOfStock ?? 0, language) })} icon={Package} loading={loading} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <SectionCard title={t("mdash.ordersByMonth")} description={t("dash.byMonth", { year })} href="/pos/reports" loading={loading}>
                  <ChartContainer config={cfg} className="h-56 w-full">
                    <BarChart data={series}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="orders" fill="var(--color-orders)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                </SectionCard>
                <SectionCard title={t("mdash.heatmap")} description={t("mdash.heatmapDesc")} loading={loading}>
                  <Heatmap cells={s.heatmap ?? []} />
                </SectionCard>
              </div>
              <SectionCard title={t("mdash.topProducts")} loading={loading} empty={!s.topProducts?.length}>
                <ul className="grid gap-2 text-sm" data-testid="mdash-top-products">
                  {s.topProducts?.map((p) => (
                    <li key={p.itemId} className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="font-medium">{p.itemName}</span>
                        <span className="text-muted-foreground ml-2 font-mono text-xs">{p.sku}</span>
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {t("mdash.qty", { n: formatNumber(p.quantity ?? 0, language) })} · <span className="text-foreground font-medium">{money(p.revenue ?? 0)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            </>
          )
        }}
      </PartGuard>
      <SectionCard title={t("mdash.outOfStockByWarehouse")} href="/inventory/warehouses" part={parts?.stock as Part<unknown> | undefined} loading={loading} empty={!stock?.byWarehouse?.length}>
        <ul className="grid gap-2 text-sm">
          {stock?.byWarehouse?.map((w) => (
            <li key={w.warehouseId} className="flex items-center justify-between">
              <span>{w.warehouseName}</span>
              <Badge variant={w.outOfStock ? "destructive" : "secondary"}>
                <PackageX className="size-3" /> {formatNumber(w.outOfStock ?? 0, language)}
              </Badge>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}

/** Orders by hour (columns) and day of week (rows, Monday first); darker = more orders. */
function Heatmap({ cells }: { cells: { dayOfWeek?: number; hour?: number; orders?: number }[] }) {
  const language = useLanguageStore((s) => s.language)
  const max = Math.max(1, ...cells.map((c) => c.orders ?? 0))
  const at = (d: number, h: number) => cells.find((c) => c.dayOfWeek === d && c.hour === h)?.orders ?? 0
  // 2024-01-01 was a Monday
  const day = (d: number) => new Date(2024, 0, d).toLocaleString(language, { weekday: "short" })
  return (
    <div className="overflow-x-auto" data-testid="mdash-heatmap">
      <table className="w-full border-separate border-spacing-0.5 text-[10px]">
        <thead>
          <tr>
            <th />
            {Array.from({ length: 24 }, (_, h) => (
              <th key={h} className="text-muted-foreground font-normal">
                {h % 3 === 0 ? h : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <tr key={d}>
              <th className="text-muted-foreground pr-1 text-right font-normal">{day(d)}</th>
              {Array.from({ length: 24 }, (_, h) => {
                const v = at(d, h)
                return <td key={h} title={`${day(d)} ${h}:00 · ${v}`} className="bg-primary h-4 min-w-3 rounded-sm" style={{ opacity: v ? 0.2 + (0.8 * v) / max : 0.06 }} />
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ------------------------------------------------------------------ 5.6 CRM

export function CrmDashboard({ year }: { year: number }) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const { parts, error, loading } = useModule(M.crm, year)
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  const n = (v?: number) => formatNumber(v ?? 0, language)
  return (
    <PartGuard part={parts?.stats} loading={loading}>
      {(s) => {
        const maxStage = Math.max(1, ...(s.dealsByStage ?? []).map((x) => x.count ?? 0))
        return (
          <div className="grid gap-4">
            <ScopeNote scope={s.scope} />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard label={t("mdash.deals")} value={n(s.deals)} icon={Handshake} loading={loading} testId="mdash-crm-deals" />
              <StatCard label={t("mdash.leads")} value={n(s.leads)} icon={UserRoundSearch} loading={loading} />
              <StatCard label={t("mdash.calls")} value={n(s.calls)} icon={Phone} loading={loading} />
              <StatCard label={t("mdash.clients")} value={n(s.clients)} icon={Building2} loading={loading} />
              <StatCard label={t("mdash.users")} value={n(s.users)} icon={Users} loading={loading} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title={t("mdash.dealsByStage")} href="/crm/deals" loading={loading} empty={!s.dealsByStage?.length}>
                <ul className="grid gap-2 text-sm">
                  {s.dealsByStage?.map((d) => (
                    <li key={d.stageId} className="grid gap-1">
                      <div className="flex justify-between gap-2">
                        <span>{d.stageName}</span>
                        <span className="text-muted-foreground text-xs">
                          {n(d.count)} · {money(d.value ?? 0)}
                        </span>
                      </div>
                      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                        <div className="bg-primary h-full" style={{ width: `${((d.count ?? 0) / maxStage) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </SectionCard>
              <SectionCard title={t("mdash.upcomingTasks")} href="/crm/leads" loading={loading} empty={!s.upcomingTasks?.length}>
                <ul className="grid gap-2 text-sm" data-testid="mdash-crm-tasks">
                  {s.upcomingTasks?.map((tk) => (
                    <li key={tk.id} className="flex items-start justify-between gap-3">
                      <Link href={`/crm/leads/${tk.leadId}`} className="min-w-0 hover:underline">
                        <span className="font-medium">{tk.name}</span>
                        <span className="text-muted-foreground block text-xs">{tk.leadName}</span>
                      </Link>
                      <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
                        <CalendarClock className="size-3" />
                        {formatDate(tk.taskDate, language)} {tk.taskTime?.slice(0, 5)}
                        {tk.priority === "HIGH" && <AlertTriangle className="text-destructive size-3" aria-label={t("mdash.priority.HIGH")} />}
                      </span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
              <SectionCard title={t("mdash.recentDeals")} href="/crm/deals" loading={loading} empty={!s.recentDeals?.length}>
                {s.recentDeals?.map((d) => (
                  <Link key={d.id} href={`/crm/deals/${d.id}`} className="flex justify-between gap-3 text-sm hover:underline">
                    <span className="truncate">{d.name}</span>
                    <span className="shrink-0 font-medium">{money(d.price ?? 0)}</span>
                  </Link>
                ))}
              </SectionCard>
              <SectionCard title={t("mdash.recentLeads")} href="/crm/leads" loading={loading} empty={!s.recentLeads?.length}>
                {s.recentLeads?.map((l) => (
                  <Link key={l.id} href={`/crm/leads/${l.id}`} className="grid text-sm hover:underline">
                    <span className="font-medium">{l.name}</span>
                    <span className="text-muted-foreground truncate text-xs">{l.subject}</span>
                  </Link>
                ))}
              </SectionCard>
            </div>
          </div>
        )
      }}
    </PartGuard>
  )
}

// ------------------------------------------------------------------ 5.7 Support

export function SupportDashboard({ year }: { year: number }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const month = useMonths()
  const { parts, error, loading } = useModule(M.support, year)
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  const n = (v?: number) => formatNumber(v ?? 0, language)
  return (
    <PartGuard part={parts?.stats} loading={loading}>
      {(s) => {
        const series = (s.monthly ?? []).map((x) => ({ month: month(x.month), created: x.created ?? 0, closed: x.closed ?? 0 }))
        const cfg = { created: { label: t("mdash.ticketsCreated"), color: "var(--chart-1)" }, closed: { label: t("mdash.ticketsClosed"), color: "var(--chart-2)" } } satisfies ChartConfig
        const minutes = s.averageFirstResponseMinutes
        return (
          <div className="grid gap-4">
            <ScopeNote scope={s.scope} />
            <div className={grid4}>
              <StatCard label={t("mdash.tickets")} value={n(s.total)} hint={t("mdash.todayN", { n: n(s.today) })} icon={Ticket} loading={loading} testId="mdash-support-total" />
              <StatCard label={t("mdash.openTickets")} value={n(s.open)} hint={t("mdash.closedN", { n: n(s.closed) })} icon={Headset} loading={loading} />
              <StatCard label={t("mdash.firstResponse")} value={minutes == null ? "-" : t("mdash.minutes", { n: formatNumber(minutes, language, 1) })} icon={Clock} loading={loading} />
              <StatCard label={t("mdash.knowledge")} value={n(s.kbArticles)} hint={t("mdash.faqsN", { n: n(s.faqs) })} icon={LibraryBig} loading={loading} />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SectionCard title={t("mdash.ticketTrend")} description={t("dash.byMonth", { year })} href="/support/tickets" loading={loading}>
                  <ChartContainer config={cfg} className="h-64 w-full">
                    <BarChart data={series}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="created" fill="var(--color-created)" radius={4} />
                      <Bar dataKey="closed" fill="var(--color-closed)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                </SectionCard>
              </div>
              <div className="grid gap-4">
                <SectionCard title={t("mdash.byStatus")} loading={loading}>
                  <Split values={s.byStatus} label={(k) => t(`hr.status.${k}` as TranslationKey)} />
                </SectionCard>
                <SectionCard title={t("mdash.byCategory")} loading={loading} empty={!s.byCategory?.length}>
                  <ul className="grid gap-1 text-sm">
                    {s.byCategory?.map((c) => (
                      <li key={c.categoryId} className="flex justify-between">
                        <span className="flex items-center gap-1">
                          <MessageCircleQuestion className="size-3" /> {c.name}
                        </span>
                        <span className="font-medium">{n(c.count)}</span>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              </div>
            </div>
          </div>
        )
      }}
    </PartGuard>
  )
}
