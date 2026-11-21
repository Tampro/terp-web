"use client"

import * as React from "react"
import Link from "next/link"
import { Building2, CircleDollarSign, Clock, Layers, TrendingDown, TrendingUp, Users } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { AdminDashboardService, type AdminDashboard } from "@/lib/admin/admin.service"
import { formatDate, formatNumber } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

const MONTHS = Array.from({ length: 12 }, (_, i) => i)

/** §3.1 Super Admin dashboard — GET /saas/admin/dashboard?year=. */
export function SuperAdminDashboard() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const currentYear = new Date().getFullYear()
  const [year, setYear] = React.useState(currentYear)
  const [state, setState] = React.useState<{ data?: AdminDashboard; error?: string; loading: boolean }>({
    loading: true,
  })

  React.useEffect(() => {
    let cancelled = false
    AdminDashboardService.get(year)
      .then((data) => !cancelled && setState({ data, loading: false }))
      .catch((e: Error) => !cancelled && setState({ error: e.message, loading: false }))
    return () => {
      cancelled = true
    }
  }, [year])

  const d = state.data
  const monthLabel = (m: number) => new Date(2000, m, 1).toLocaleString(language, { month: "short" })
  const series = MONTHS.map((m) => ({
    month: monthLabel(m),
    companies: d?.newCompaniesByMonth?.[m] ?? 0,
    revenue: Number(d?.revenueByMonth?.[m] ?? 0),
  }))
  const growth = d?.monthlyGrowthPercent

  const cards: { key: TranslationKey; value: string; icon: React.ElementType; hint?: string }[] = [
    { key: "dash.totalRevenue", value: formatNumber(d?.totalRevenue, language, 2), icon: CircleDollarSign },
    {
      key: "dash.totalCompanies",
      value: formatNumber(d?.totalCompanies, language),
      icon: Building2,
      hint: t("dash.activeOf", { n: formatNumber(d?.activeCompanies, language) }),
    },
    { key: "dash.activePlans", value: formatNumber(d?.activePlans, language), icon: Layers },
    { key: "dash.totalUsers", value: formatNumber(d?.totalUsers, language), icon: Users },
    { key: "dash.pendingRequests", value: formatNumber(d?.pendingRequests, language), icon: Clock },
  ]

  const companiesConfig = { companies: { label: t("dash.newCompanies"), color: "var(--primary)" } } satisfies ChartConfig
  const revenueConfig = { revenue: { label: t("dash.revenue"), color: "var(--chart-2)" } } satisfies ChartConfig

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader title={t("menu.dashboard")} description={t("dash.subtitle")}>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(({ key, value, icon: Icon, hint }) => (
          <Card key={key}>
            <CardContent className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-muted-foreground text-sm">{t(key)}</p>
                {state.loading ? (
                  <Skeleton className="mt-2 h-7 w-20" />
                ) : (
                  <p className="mt-1 text-2xl font-semibold" data-testid={key}>
                    {value}
                  </p>
                )}
                {hint && !state.loading && <p className="text-muted-foreground text-xs">{hint}</p>}
              </div>
              <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {growth !== null && growth !== undefined && !state.loading && (
        <p className="text-muted-foreground flex items-center gap-1 text-sm">
          {growth >= 0 ? <TrendingUp className="size-4 text-emerald-500" /> : <TrendingDown className="text-destructive size-4" />}
          {t("dash.growth", { n: formatNumber(growth, language, 1) })}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("dash.newCompanies")}</CardTitle>
            <CardDescription>{t("dash.byMonth", { year })}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={companiesConfig} className="h-64 w-full">
              <BarChart data={series}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="companies" fill="var(--color-companies)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("dash.revenue")}</CardTitle>
            <CardDescription>{t("dash.byMonth", { year })}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueConfig} className="h-64 w-full">
              <LineChart data={series}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={56} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("dash.recentCompanies")}</CardTitle>
            <Link href="/companies" className="text-primary text-sm hover:underline">
              {t("common.viewAll")}
            </Link>
          </CardHeader>
          <CardContent className="grid gap-3">
            {!state.loading && !d?.recentCompanies?.length && (
              <p className="text-muted-foreground text-sm">{t("common.noData")}</p>
            )}
            {d?.recentCompanies?.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name ?? "-"}</p>
                  <p className="text-muted-foreground truncate text-xs">{c.email ?? "-"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-muted-foreground text-xs">{formatDate(c.createdDate, language)}</span>
                  <Badge variant={c.status === "ACTIVE" ? "secondary" : "outline"}>
                    {c.status === "ACTIVE" ? t("companies.enabled") : t("companies.disabled")}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("dash.topPlans")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {!state.loading && !d?.topPlans?.length && <p className="text-muted-foreground text-sm">{t("common.noData")}</p>}
            {d?.topPlans?.map((p) => (
              <div key={p.planId ?? p.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium">{p.name ?? "-"}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {t("dash.subscribers", { n: formatNumber(p.subscribers, language) })} ·{" "}
                  {formatNumber(p.revenue, language, 2)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
