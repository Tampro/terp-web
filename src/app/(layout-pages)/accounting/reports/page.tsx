"use client"

import * as React from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import { AccountingReportService, type AgingReport, type AgingRow, type BalanceRow, type TaxSummary } from "@/lib/accounting/accounting.service"
import { useT, type TranslationKey } from "@/lib/i18n"
import { saveBlob } from "@/lib/pos/pos.service"

import { errorMessage, today } from "../_components/acc-kit"

type Tab = "invoice-aging" | "bill-aging" | "tax" | "customer-balances" | "vendor-balances"
const TABS: Tab[] = ["invoice-aging", "bill-aging", "tax", "customer-balances", "vendor-balances"]
const BUCKETS: (keyof AgingRow)[] = ["current", "days1To30", "days31To60", "days61To90", "over90", "total"]
const firstOfYear = () => new Date(new Date().getFullYear(), 0, 1).toLocaleDateString("en-CA")

export default function AccountingReportsPage() {
  return (
    <React.Suspense>
      <Reports />
    </React.Suspense>
  )
}

/** §12.6 invoice aging and bill aging (Current, 1–30, 31–60, 61–90, over 90, PDF), tax summary, customer / vendor balance (zero toggle). */
function Reports() {
  const t = useT()
  const money = useMoney()
  const { searchParams, update } = useUrlQuery()
  const tab = (TABS.find((x) => x === searchParams.get("tab")) ?? "invoice-aging") as Tab
  const asOf = searchParams.get("asOf") ?? today()
  const from = searchParams.get("from") ?? firstOfYear()
  const to = searchParams.get("to") ?? today()
  const showZero = searchParams.get("zero") === "1"
  const key = `${tab}|${asOf}|${from}|${to}|${showZero}`
  const [state, setState] = React.useState<{ key: string; aging?: AgingReport; tax?: TaxSummary; balances?: BalanceRow[]; error?: string }>()

  React.useEffect(() => {
    let cancelled = false
    const [tb, a, f, tt, z] = key.split("|")
    const load: Promise<Omit<NonNullable<typeof state>, "key">> =
      tb === "invoice-aging"
        ? AccountingReportService.invoiceAging(a).then((aging) => ({ aging }))
        : tb === "bill-aging"
          ? AccountingReportService.billAging(a).then((aging) => ({ aging }))
          : tb === "tax"
            ? AccountingReportService.taxSummary(f, tt).then((tax) => ({ tax }))
            : (tb === "customer-balances" ? AccountingReportService.customerBalances(z === "true") : AccountingReportService.vendorBalances(z === "true")).then((balances) => ({ balances }))
    load.then((d) => !cancelled && setState({ key, ...d })).catch((e: Error) => !cancelled && setState({ key, error: e.message }))
    return () => {
      cancelled = true
    }
  }, [key])

  const s = state?.key === key ? state : undefined
  async function pdf() {
    try {
      // every report has a PDF (manual 12.6): aging as of a date, tax for the period, balances with the zero toggle
      const blob =
        tab === "invoice-aging"
          ? await AccountingReportService.invoiceAgingPdf(asOf)
          : tab === "bill-aging"
            ? await AccountingReportService.billAgingPdf(asOf)
            : tab === "tax"
              ? await AccountingReportService.taxSummaryPdf(from, to)
              : tab === "customer-balances"
                ? await AccountingReportService.customerBalancesPdf(showZero)
                : await AccountingReportService.vendorBalancesPdf(showZero)
      saveBlob(blob, `${tab}-${tab === "tax" ? `${from}_${to}` : aging ? asOf : today()}.pdf`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const aging = tab === "invoice-aging" || tab === "bill-aging"
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.acc.reports")} description={t("acc.reports.subtitle")}>
        {aging && (
          <>
            <Input type="date" className="w-40" aria-label={t("acc.reports.asOf")} value={asOf} onChange={(e) => update({ asOf: e.target.value })} />
          </>
        )}
        {tab === "tax" && (
          <>
            <Input type="date" className="w-40" aria-label={t("sales.from")} value={from} onChange={(e) => update({ from: e.target.value })} />
            <Input type="date" className="w-40" aria-label={t("sales.to")} value={to} onChange={(e) => update({ to: e.target.value })} />
          </>
        )}
        {!aging && tab !== "tax" && (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={showZero} onCheckedChange={(c) => update({ zero: c ? "1" : "" })} aria-label={t("acc.reports.showZero")} /> {t("acc.reports.showZero")}
          </label>
        )}
        <Button variant="outline" disabled={!s || !!s.error} onClick={pdf}>
          <Download className="size-4" /> {t("pos.downloadPdf")}
        </Button>
      </PageHeader>
      <Tabs value={tab} onValueChange={(v) => update({ tab: v === "invoice-aging" ? "" : v })}>
        <div className="overflow-x-auto">
          <TabsList>
            {TABS.map((x) => (
              <TabsTrigger key={x} value={x}>
                {t(`acc.reports.${x}` as TranslationKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      {!s ? (
        <Skeleton className="h-48 w-full" />
      ) : s.error ? (
        <p className="text-destructive text-sm">{s.error}</p>
      ) : aging ? (
        <Card>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t(tab === "invoice-aging" ? "sales.customer" : "purchase.vendor")}</TableHead>
                  {BUCKETS.map((b) => (
                    <TableHead key={b} className="text-right">
                      {t(`acc.reports.bucket.${b}` as TranslationKey)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(s.aging?.rows ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground h-16 text-center">
                      {t("acc.reports.nothingOpen")}
                    </TableCell>
                  </TableRow>
                )}
                {(s.aging?.rows ?? []).map((r) => (
                  <TableRow key={r.partyId}>
                    <TableCell className="font-medium">{r.partyName}</TableCell>
                    {BUCKETS.map((b) => (
                      <TableCell key={b} className={`text-right ${b === "total" ? "font-medium" : ""} ${b === "over90" && (r.over90 ?? 0) > 0 ? "text-destructive" : ""}`}>
                        {money(r[b] as number)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              {(s.aging?.rows ?? []).length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell>{t("sales.total")}</TableCell>
                    {BUCKETS.map((b) => (
                      <TableCell key={b} className="text-right font-semibold">
                        {money(s.aging?.totals?.[b] as number)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </CardContent>
        </Card>
      ) : tab === "tax" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <TaxCard title={t("acc.reports.collected")} rows={[[t("acc.reports.outputTax"), s.tax?.outputTax], [t("acc.reports.creditNoteTax"), -(s.tax?.creditNoteTax ?? 0)]]} total={s.tax?.netOutputTax} hint={t("acc.reports.invoicesN", { n: s.tax?.salesInvoices ?? 0 })} money={money} />
          <TaxCard title={t("acc.reports.paid")} rows={[[t("acc.reports.inputTax"), s.tax?.inputTax], [t("acc.reports.debitNoteTax"), -(s.tax?.debitNoteTax ?? 0)]]} total={s.tax?.netInputTax} hint={t("acc.reports.invoicesN", { n: s.tax?.purchaseInvoices ?? 0 })} money={money} />
          <Card>
            <CardHeader>
              <CardDescription>{t("acc.reports.netLiability")}</CardDescription>
              <CardTitle className={`text-2xl ${(s.tax?.netTaxLiability ?? 0) < 0 ? "text-emerald-600" : ""}`} data-testid="tax-net">
                {money(s.tax?.netTaxLiability)}
              </CardTitle>
              <CardDescription>{t("acc.reports.netHint")}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("acc.code")}</TableHead>
                  <TableHead>{t("crm.name")}</TableHead>
                  <TableHead className="text-right">{t("acc.reports.openInvoices")}</TableHead>
                  <TableHead className="text-right">{t("acc.reports.unappliedNotes")}</TableHead>
                  <TableHead className="text-right">{t("acc.report.balance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(s.balances ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground h-16 text-center">
                      {t("acc.reports.nothingOpen")}
                    </TableCell>
                  </TableRow>
                )}
                {(s.balances ?? []).map((r) => (
                  <TableRow key={r.partyId}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">{money(r.openInvoices)}</TableCell>
                    <TableCell className="text-right">{money(r.unappliedNotes)}</TableCell>
                    <TableCell className="text-right font-semibold">{money(r.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function TaxCard({ title, rows, total, hint, money }: { title: string; rows: [string, number | undefined][]; total?: number; hint: string; money: (n?: number | null) => string }) {
  const t = useT()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-1 text-sm">
        {rows.map(([l, v]) => (
          <div key={l} className="flex justify-between">
            <span>{l}</span>
            <span>{money(v)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t pt-1 font-semibold">
          <span>{t("acc.reports.net")}</span>
          <span>{money(total)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
