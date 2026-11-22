"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import { CrmReportService, type CountRow, type DealReport, type LeadReport } from "@/lib/crm/crm.service"
import { formatNumber } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { useCrmLookups, userName } from "../_components/use-crm-lookups"

const ALL = "ALL"
const THIS_YEAR = new Date().getFullYear()

/**
 * §7.4 CRM reports for one year (and optionally one pipeline): leads by stage, source, month, staff and conversion;
 * deals by status, stage (count + value), source and month. Stage figures come only for one pipeline (ReportService).
 * TODO(assumption): "weekly conversion" and deal reports by staff / client have no backend figure yet (ReportService).
 */
export default function CrmReportsPage() {
  return (
    <React.Suspense>
      <CrmReports />
    </React.Suspense>
  )
}

function CrmReports() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const lookups = useCrmLookups()
  const { searchParams, update } = useUrlQuery()
  const tab = searchParams.get("tab") === "deals" ? "deals" : "leads"
  const year = Number(searchParams.get("year") ?? THIS_YEAR) || THIS_YEAR
  const pipelineId = searchParams.get("pipelineId") ?? undefined
  const [leads, setLeads] = React.useState<LeadReport>()
  const [deals, setDeals] = React.useState<DealReport>()

  React.useEffect(() => {
    let cancelled = false
    Promise.all([CrmReportService.leads(year, pipelineId), CrmReportService.deals(year, pipelineId)])
      .then(([l, d]) => !cancelled && (setLeads(l), setDeals(d)))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [year, pipelineId])

  const monthName = (m?: number) =>
    m ? new Date(2000, m - 1, 1).toLocaleDateString(language === "vi" ? "vi-VN" : language === "ko" ? "ko-KR" : "en-US", { month: "short" }) : ""
  const leadMonths = (leads?.byMonth ?? []).map((m) => ({ month: monthName(m.month), created: m.created ?? 0, converted: m.converted ?? 0 }))
  const dealMonths = (deals?.byMonth ?? []).map((m) => ({ month: monthName(m.month), count: m.count ?? 0, value: m.value ?? 0 }))
  const leadConfig = {
    created: { label: t("crm.report.created"), color: "var(--chart-1)" },
    converted: { label: t("crm.report.converted"), color: "var(--chart-2)" },
  } satisfies ChartConfig
  const dealConfig = {
    count: { label: t("crm.report.deals"), color: "var(--chart-1)" },
    value: { label: t("crm.report.value"), color: "var(--chart-2)" },
  } satisfies ChartConfig

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.crm.reports")} description={t("crm.report.subtitle")}>
        <Select value={pipelineId ?? ALL} onValueChange={(v) => update({ pipelineId: v === ALL ? "" : v })}>
          <SelectTrigger className="w-48" aria-label={t("crm.pipeline")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("crm.allPipelines")}</SelectItem>
            {lookups.pipelines.map((p) => (
              <SelectItem key={p.id} value={p.id ?? ""}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => update({ year: v })}>
          <SelectTrigger className="w-28" aria-label={t("crm.year")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[0, 1, 2, 3, 4].map((d) => (
              <SelectItem key={d} value={String(THIS_YEAR - d)}>
                {THIS_YEAR - d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      <Tabs value={tab} onValueChange={(v) => update({ tab: v })}>
        <TabsList>
          <TabsTrigger value="leads">{t("crm.report.leads")}</TabsTrigger>
          <TabsTrigger value="deals">{t("crm.report.deals")}</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="flex flex-col gap-4">
          {!leads ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label={t("crm.report.totalLeads")} value={formatNumber(leads.total, language)} />
                <Stat label={t("crm.report.converted")} value={formatNumber(leads.converted, language)} />
                <Stat label={t("crm.report.conversion")} value={`${formatNumber(leads.conversionPercent, language)}%`} />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("crm.report.byMonth")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={leadConfig} className="h-64 w-full">
                    <BarChart data={leadMonths}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="created" fill="var(--color-created)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="converted" fill="var(--color-converted)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
              <div className="grid gap-4 md:grid-cols-3">
                <CountList title="crm.report.byStage" rows={leads.byStage} language={language} empty={pipelineId ? undefined : "crm.report.stageNeedsPipeline"} />
                <CountList title="crm.report.bySource" rows={leads.bySource} language={language} />
                {/* Spec: byUser carries the owner user id only (ReportService: name null) */}
                <CountList
                  title="crm.report.byStaff"
                  rows={leads.byUser?.map((r) => ({ ...r, name: r.name ?? userName(lookups.users, r.id) }))}
                  language={language}
                />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="deals" className="flex flex-col gap-4">
          {!deals ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Stat label={t("crm.report.totalDeals")} value={formatNumber(deals.total, language)} />
                <Stat label={t("crm.report.totalValue")} value={money(deals.totalValue)} />
                {(["ACTIVE", "WON", "LOSS"] as const).map((s) => (
                  <Stat
                    key={s}
                    label={t(`crm.dealStatus.${s}` as TranslationKey)}
                    value={formatNumber(deals.byStatus?.[s]?.count, language)}
                    hint={money(deals.byStatus?.[s]?.value)}
                  />
                ))}
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("crm.report.byMonth")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={dealConfig} className="h-64 w-full">
                    <LineChart data={dealMonths}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis yAxisId="count" allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                      <YAxis yAxisId="value" orientation="right" tickLine={false} axisLine={false} width={64} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line yAxisId="count" dataKey="count" stroke="var(--color-count)" strokeWidth={2} dot={false} />
                      <Line yAxisId="value" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("crm.report.byStage")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="grid gap-2 text-sm">
                      {(deals.byStage ?? []).length === 0 && (
                        <li className="text-muted-foreground">{t(pipelineId ? "crm.noEntries" : "crm.report.stageNeedsPipeline")}</li>
                      )}
                      {(deals.byStage ?? []).map((r) => (
                        <li key={r.id} className="flex justify-between gap-4">
                          <span>{r.name}</span>
                          <span className="text-muted-foreground">
                            {formatNumber(r.count, language)} · {money(r.value)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <CountList title="crm.report.bySource" rows={deals.bySource} language={language} />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
        {hint && <CardDescription>{hint}</CardDescription>}
      </CardHeader>
    </Card>
  )
}

function CountList({
  title,
  rows,
  language,
  empty = "crm.noEntries",
}: {
  title: TranslationKey
  rows?: CountRow[]
  language: string
  /** shown when there are no rows */
  empty?: TranslationKey
}) {
  const t = useT()
  const max = Math.max(1, ...(rows ?? []).map((r) => r.count ?? 0))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t(title)}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 text-sm">
          {(rows ?? []).length === 0 && <li className="text-muted-foreground">{t(empty)}</li>}
          {(rows ?? []).map((r) => (
            <li key={r.id ?? r.name} className="grid gap-1">
              <div className="flex justify-between gap-4">
                <span>{r.name}</span>
                <span className="text-muted-foreground">{formatNumber(r.count, language)}</span>
              </div>
              <div className="bg-muted h-1.5 rounded">
                <div className="bg-primary h-1.5 rounded" style={{ width: `${((r.count ?? 0) / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
