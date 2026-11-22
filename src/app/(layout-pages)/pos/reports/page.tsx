"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import { formatDate, formatNumber } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"
import { PosService, type CustomerReport, type ProductReport, type SalesReport } from "@/lib/pos/pos.service"

const iso = (d: Date) => d.toLocaleDateString("en-CA")
const DEFAULT_FROM = () => {
  const d = new Date()
  return iso(new Date(d.getFullYear(), d.getMonth(), 1))
}
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

export default function PosReportsPage() {
  return (
    <React.Suspense>
      <PosReports />
    </React.Suspense>
  )
}

/**
 * §10 Reports for a period (≤ 366 days, POS_007): sales (daily, monthly, by warehouse), products (top 10 by revenue,
 * quantity split, table), customers (top 10 by spend, average order value, last order).
 */
function PosReports() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const { searchParams, update } = useUrlQuery()
  const tab = searchParams.get("tab") ?? "sales"
  const from = searchParams.get("from") ?? DEFAULT_FROM()
  const to = searchParams.get("to") ?? iso(new Date())
  const [data, setData] = React.useState<{ key: string; sales?: SalesReport; products?: ProductReport; customers?: CustomerReport; error?: string }>()
  const key = `${from}|${to}`

  React.useEffect(() => {
    let cancelled = false
    Promise.all([PosService.salesReport(from, to), PosService.productReport(from, to), PosService.customerReport(from, to)])
      .then(([sales, products, customers]) => !cancelled && setData({ key: `${from}|${to}`, sales, products, customers }))
      .catch((e: Error) => {
        if (cancelled) return
        setData({ key: `${from}|${to}`, error: e.message })
        toast.error(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [from, to])

  const d = data?.key === key ? data : undefined
  const daily = (d?.sales?.daily ?? []).map((x) => ({ day: formatDate(x.date, language).slice(0, 5), total: x.total ?? 0 }))
  const monthly = (d?.sales?.monthly ?? []).map((x) => ({ month: x.month ?? "", total: x.total ?? 0 }))
  const top = (d?.products?.top10 ?? []).map((x) => ({ name: x.itemName ?? "-", revenue: x.revenue ?? 0, quantity: x.quantity ?? 0 }))
  const salesConfig = { total: { label: t("sales.total"), color: "var(--chart-1)" } } satisfies ChartConfig
  const productConfig = { revenue: { label: t("pos.report.revenue"), color: "var(--chart-2)" } } satisfies ChartConfig

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.pos.reports")} description={t("pos.report.subtitle")}>
        <Input type="date" className="w-40" aria-label={t("sales.from")} value={from} onChange={(e) => update({ from: e.target.value })} />
        <Input type="date" className="w-40" aria-label={t("sales.to")} value={to} onChange={(e) => update({ to: e.target.value })} />
      </PageHeader>
      <Tabs value={tab} onValueChange={(v) => update({ tab: v === "sales" ? "" : v })}>
        <TabsList>
          <TabsTrigger value="sales">{t("pos.report.sales")}</TabsTrigger>
          <TabsTrigger value="products">{t("pos.report.products")}</TabsTrigger>
          <TabsTrigger value="customers">{t("pos.report.customers")}</TabsTrigger>
        </TabsList>
        {!d ? (
          <Skeleton className="mt-4 h-64 w-full" />
        ) : d.error ? (
          <p className="text-destructive mt-4 text-sm">{d.error}</p>
        ) : (
          <>
            <TabsContent value="sales" className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Stat label={t("pos.report.orders")} value={formatNumber(d.sales?.orders, language)} />
                <Stat label={t("pos.report.totalSales")} value={money(d.sales?.total)} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title={t("pos.report.daily")}>
                  <ChartContainer config={salesConfig} className="h-56 w-full">
                    <BarChart data={daily}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={64} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </ChartCard>
                <ChartCard title={t("pos.report.monthly")}>
                  <ChartContainer config={salesConfig} className="h-56 w-full">
                    <BarChart data={monthly}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={64} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </ChartCard>
              </div>
              <ChartCard title={t("pos.report.byWarehouse")}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("sales.warehouse")}</TableHead>
                      <TableHead className="text-right">{t("pos.report.orders")}</TableHead>
                      <TableHead className="text-right">{t("sales.total")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <Empty show={(d.sales?.byWarehouse ?? []).length === 0} cols={3} />
                    {(d.sales?.byWarehouse ?? []).map((w) => (
                      <TableRow key={w.warehouseId}>
                        <TableCell>{w.warehouseName}</TableCell>
                        <TableCell className="text-right">{formatNumber(w.orders, language)}</TableCell>
                        <TableCell className="text-right">{money(w.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ChartCard>
            </TabsContent>

            <TabsContent value="products" className="flex flex-col gap-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title={t("pos.report.top10Products")}>
                  <ChartContainer config={productConfig} className="h-64 w-full">
                    <BarChart data={top} layout="vertical">
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={120} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                </ChartCard>
                <ChartCard title={t("pos.report.quantitySplit", { n: formatNumber(d.products?.totalQuantity, language, 2) })}>
                  <ChartContainer config={{}} className="h-64 w-full">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                      <Pie data={top} dataKey="quantity" nameKey="name" innerRadius={50}>
                        {top.map((x, i) => (
                          <Cell key={x.name} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                </ChartCard>
              </div>
              <ChartCard title={t("pos.report.allProducts")}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("sales.item")}</TableHead>
                      <TableHead className="text-right">{t("sales.quantity")}</TableHead>
                      <TableHead className="text-right">{t("pos.report.orders")}</TableHead>
                      <TableHead className="text-right">{t("pos.report.revenue")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <Empty show={(d.products?.all ?? []).length === 0} cols={4} />
                    {(d.products?.all ?? []).map((p) => (
                      <TableRow key={p.itemId}>
                        <TableCell>
                          {p.itemName} <span className="text-muted-foreground font-mono text-xs">{p.sku}</span>
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(p.quantity, language, 2)}</TableCell>
                        <TableCell className="text-right">{formatNumber(p.orders, language)}</TableCell>
                        <TableCell className="text-right">{money(p.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ChartCard>
            </TabsContent>

            <TabsContent value="customers">
              <ChartCard title={t("pos.report.top10Customers")}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("sales.customer")}</TableHead>
                      <TableHead className="text-right">{t("pos.report.orders")}</TableHead>
                      <TableHead className="text-right">{t("pos.report.spent")}</TableHead>
                      <TableHead className="text-right">{t("pos.report.average")}</TableHead>
                      <TableHead>{t("pos.report.lastOrder")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <Empty show={(d.customers?.top10 ?? []).length === 0} cols={5} />
                    {(d.customers?.top10 ?? []).map((c) => (
                      <TableRow key={c.customerId ?? "walk-in"}>
                        <TableCell>{c.customerName ?? t("pos.walkIn")}</TableCell>
                        <TableCell className="text-right">{formatNumber(c.orders, language)}</TableCell>
                        <TableCell className="text-right">{money(c.spent)}</TableCell>
                        <TableCell className="text-right">{money(c.averageOrderValue)}</TableCell>
                        <TableCell>{formatDate(c.lastOrderDate, language)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ChartCard>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">{children}</CardContent>
    </Card>
  )
}

function Empty({ show, cols }: { show: boolean; cols: number }) {
  const t = useT()
  if (!show) return null
  return (
    <TableRow>
      <TableCell colSpan={cols} className="text-muted-foreground h-16 text-center">
        {t("pos.report.empty")}
      </TableCell>
    </TableRow>
  )
}
