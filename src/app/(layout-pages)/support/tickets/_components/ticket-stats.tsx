"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { SupportService, TICKET_STATUSES, type TicketStats } from "@/lib/support/support.service"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { PlainSelect } from "../../../hrm/_components/crud-kit"

/**
 * Support figures (GET /support/tickets/stats): all-time totals, average first staff response, status and category split,
 * KB / FAQ counts and the created / closed tickets per month of the chosen year. A SUPPORT_TICKET_VIEW_OWN user gets only
 * their own tickets (scope OWN). Months and "today" are counted in the browser's time zone (`tz`).
 */
export function TicketStatsTab() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const thisYear = new Date().getFullYear()
  const [year, setYear] = React.useState(thisYear)
  const [data, setData] = React.useState<{ year: number; stats?: TicketStats; error?: string }>()
  React.useEffect(() => {
    let cancelled = false
    SupportService.stats(year, Intl.DateTimeFormat().resolvedOptions().timeZone)
      .then((stats) => !cancelled && setData({ year, stats }))
      .catch((e: unknown) => !cancelled && setData({ year, error: e instanceof Error ? e.message : String(e) }))
    return () => {
      cancelled = true
    }
  }, [year])
  const s = data?.year === year ? data.stats : undefined
  const config = { created: { label: t("sp.stats.created"), color: "var(--chart-1)" }, closed: { label: t("sp.stats.closed"), color: "var(--chart-2)" } } satisfies ChartConfig
  const series = Array.from({ length: 12 }, (_, i) => {
    const m = s?.monthly?.find((x) => x.month === i + 1)
    return { month: new Date(2000, i, 1).toLocaleDateString(language, { month: "short" }), created: m?.created ?? 0, closed: m?.closed ?? 0 }
  })
  const avg = s?.averageFirstResponseMinutes
  const avgText = avg == null ? "-" : avg >= 60 ? t("sp.stats.hours", { n: (avg / 60).toFixed(1) }) : t("sp.stats.minutes", { n: Math.round(avg) })
  const cards: [TranslationKey, string | number, string][] = [
    ["sp.stats.total", s?.total ?? 0, "total"],
    ["sp.stats.open", s?.open ?? 0, "open"],
    ["sp.stats.closedAll", s?.closed ?? 0, "closed"],
    ["sp.stats.today", s?.today ?? 0, "today"],
    ["sp.stats.firstResponse", avgText, "first-response"],
    ["sp.stats.kb", s?.kbArticles ?? 0, "kb"],
    ["sp.stats.faqs", s?.faqs ?? 0, "faqs"],
  ]
  const categories = [...(s?.byCategory ?? [])].sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
  const maxCat = Math.max(1, ...categories.map((c) => c.count ?? 0))
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <PlainSelect label={t("hd.year")} className="w-32" value={String(year)} onChange={(v) => setYear(Number(v))} options={[0, 1, 2, 3].map((i) => ({ value: String(thisYear - i), label: String(thisYear - i) }))} />
        {s?.scope === "OWN" && <span className="text-muted-foreground text-sm">{t("sp.stats.own")}</span>}
      </div>
      {data?.error && data.year === year && <p className="text-destructive text-sm">{data.error}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {cards.map(([k, v, id]) => (
          <Card key={k} className="gap-1 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-muted-foreground text-xs font-normal">{t(k)}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 text-2xl font-semibold" data-testid={`sp-stat-${id}`}>
              {s ? v : <Skeleton className="h-7 w-12" />}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("sp.stats.monthly", { year })}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={config} className="h-64 w-full">
              <BarChart data={series}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} width={30} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="created" fill="var(--color-created)" radius={4} />
                <Bar dataKey="closed" fill="var(--color-closed)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("sp.stats.byStatus")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {TICKET_STATUSES.map((st) => (
                <div key={st} className="flex justify-between" data-testid={`sp-status-${st}`}>
                  <span>{t(`hr.status.${st}` as TranslationKey)}</span>
                  <span className="font-medium">{s?.byStatus?.[st] ?? 0}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("sp.stats.byCategory")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {categories.length === 0 && <span className="text-muted-foreground">-</span>}
              {categories.map((c) => (
                <div key={c.categoryId ?? c.name} className="grid gap-1">
                  <div className="flex justify-between">
                    <span className="truncate">{c.name ?? t("sp.stats.noCategory")}</span>
                    <span className="font-medium">{c.count ?? 0}</span>
                  </div>
                  <div className="bg-muted h-1.5 rounded-full">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${((c.count ?? 0) / maxCat) * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
