"use client"

import * as React from "react"
import { Download, Printer } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import {
  LedgerReportService,
  type AccountBalances,
  type AmountGroup,
  type CashFlow,
  type ELedgerReport,
  type ExpenseReport,
  type GeneralLedger,
  type ProfitLoss,
  type TrialBalance,
} from "@/lib/accounting/ledger.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { openBlob, saveBlob } from "@/lib/pos/pos.service"

import { accountLabel, errorMessage, PlainSelect, today, useAccLookups } from "../_components/acc-kit"

const REPORTS: ELedgerReport[] = ["trial-balance", "profit-loss", "cash-flow", "general-ledger", "account-statement", "account-balances", "expense-report"]
const firstOfYear = () => new Date(new Date().getFullYear(), 0, 1).toLocaleDateString("en-CA")
type Data = { trial?: TrialBalance; pl?: ProfitLoss; cash?: CashFlow; ledger?: GeneralLedger; balances?: AccountBalances; expense?: ExpenseReport }

export default function LedgerReportsPage() {
  return (
    <React.Suspense>
      <LedgerReports />
    </React.Suspense>
  )
}

/** §13 trial balance, profit & loss, cash flow, general ledger, account statement, account balance, expense report: date range, PDF / print. */
function LedgerReports() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const { accounts } = useAccLookups()
  const { searchParams, update } = useUrlQuery()
  const report = REPORTS.find((x) => x === searchParams.get("report")) ?? "trial-balance"
  const from = searchParams.get("from") ?? firstOfYear()
  const to = searchParams.get("to") ?? today()
  const asOf = searchParams.get("asOf") ?? today()
  const hideZero = searchParams.get("zero") !== "1"
  const accountId = searchParams.get("accountId") ?? ""
  const perAccount = report === "general-ledger" || report === "account-statement"
  const ready = !perAccount || !!accountId
  const key = JSON.stringify({ report, from, to, asOf, hideZero, accountId })
  const [state, setState] = React.useState<{ key: string; data?: Data; error?: string }>()

  React.useEffect(() => {
    if (!ready) return
    let cancelled = false
    const q = JSON.parse(key) as { report: ELedgerReport; from: string; to: string; asOf: string; hideZero: boolean; accountId: string }
    const S = LedgerReportService
    const load: Promise<Data> = {
      "trial-balance": () => S.trialBalance(q.from, q.to).then((trial) => ({ trial })),
      "profit-loss": () => S.profitLoss(q.from, q.to).then((pl) => ({ pl })),
      "cash-flow": () => S.cashFlow(q.from, q.to).then((cash) => ({ cash })),
      "general-ledger": () => S.generalLedger(q.accountId, q.from, q.to).then((ledger) => ({ ledger })),
      "account-statement": () => S.accountStatement(q.accountId, q.from, q.to).then((ledger) => ({ ledger })),
      "account-balances": () => S.accountBalances(q.asOf, q.hideZero).then((balances) => ({ balances })),
      "expense-report": () => S.expenseReport(q.from, q.to).then((expense) => ({ expense })),
    }[q.report]()
    load.then((data) => !cancelled && setState({ key, data })).catch((e: Error) => !cancelled && setState({ key, error: e.message }))
    return () => {
      cancelled = true
    }
  }, [key, ready])

  const s = state?.key === key ? state : undefined
  async function pdf(print: boolean) {
    try {
      const blob = await LedgerReportService.pdf(report, report === "account-balances" ? { asOf, hideZero } : { from, to, accountId: perAccount ? accountId : undefined })
      if (print) openBlob(blob)
      else saveBlob(blob, `${report}-${report === "account-balances" ? asOf : `${from}_${to}`}.pdf`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const d = s?.data
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.le.reports")} description={t("le.reports.subtitle")}>
        <Button variant="outline" disabled={!d} onClick={() => pdf(false)}>
          <Download className="size-4" /> {t("pos.downloadPdf")}
        </Button>
        <Button variant="outline" disabled={!d} onClick={() => pdf(true)}>
          <Printer className="size-4" /> {t("le.print")}
        </Button>
      </PageHeader>
      <Tabs value={report} onValueChange={(v) => update({ report: v === "trial-balance" ? "" : v })}>
        <div className="overflow-x-auto">
          <TabsList>
            {REPORTS.map((x) => (
              <TabsTrigger key={x} value={x}>
                {t(`le.report.${x}` as TranslationKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      <div className="flex flex-wrap items-center gap-3">
        {perAccount && (
          <PlainSelect
            label={t("le.account")}
            className="w-72"
            value={accountId}
            onChange={(v) => update({ accountId: v })}
            options={accounts.map((a) => ({ value: a.id ?? "", label: accountLabel(a) }))}
          />
        )}
        {report === "account-balances" ? (
          <>
            <Input type="date" className="w-40" aria-label={t("acc.reports.asOf")} value={asOf} onChange={(e) => update({ asOf: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!hideZero} onCheckedChange={(c) => update({ zero: c ? "1" : "" })} aria-label={t("acc.reports.showZero")} /> {t("acc.reports.showZero")}
            </label>
          </>
        ) : (
          <>
            <Input type="date" className="w-40" aria-label={t("sales.from")} value={from} onChange={(e) => update({ from: e.target.value })} />
            <Input type="date" className="w-40" aria-label={t("sales.to")} value={to} onChange={(e) => update({ to: e.target.value })} />
          </>
        )}
      </div>

      {!ready ? (
        <p className="text-muted-foreground text-sm">{t("le.pickAccount")}</p>
      ) : !s ? (
        <Skeleton className="h-48 w-full" />
      ) : s.error ? (
        <p className="text-destructive text-sm">{s.error}</p>
      ) : report === "trial-balance" ? (
        <TrialBalanceView data={d?.trial} money={money} />
      ) : report === "profit-loss" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <GroupsCard title={t("le.revenue")} groups={d?.pl?.revenue} total={d?.pl?.totalRevenue} money={money} />
          <GroupsCard title={t("le.expenses")} groups={d?.pl?.expenses} total={d?.pl?.totalExpenses} money={money} />
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardDescription>{t("le.netProfit")}</CardDescription>
              <CardTitle className={`text-2xl ${(d?.pl?.netProfit ?? 0) < 0 ? "text-destructive" : "text-emerald-600"}`} data-testid="net-profit">
                {money(d?.pl?.netProfit)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : report === "cash-flow" ? (
        <CashFlowView data={d?.cash} money={money} />
      ) : perAccount ? (
        <LedgerView data={d?.ledger} money={money} language={language} />
      ) : report === "account-balances" ? (
        <Card>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("acc.code")}</TableHead>
                  <TableHead>{t("crm.name")}</TableHead>
                  <TableHead>{t("acc.category")}</TableHead>
                  <TableHead>{t("acc.coa.normal")}</TableHead>
                  <TableHead className="text-right">{t("acc.report.balance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <EmptyRow show={!d?.balances?.rows?.length} cols={5} />
                {(d?.balances?.rows ?? []).map((r) => (
                  <TableRow key={r.accountId}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{t(`acc.coa.categoryOf.${r.category}` as TranslationKey)}</TableCell>
                    <TableCell>{t(`acc.coa.normalOf.${r.normalBalance}` as TranslationKey)}</TableCell>
                    <TableCell className="text-right font-medium">{money(r.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <GroupsCard title={t("le.report.expense-report")} groups={d?.expense?.categories} total={d?.expense?.total} money={money} />
      )}
    </div>
  )
}

type Money = (n?: number | null) => string

function EmptyRow({ show, cols }: { show: boolean; cols: number }) {
  const t = useT()
  if (!show) return null
  return (
    <TableRow>
      <TableCell colSpan={cols} className="text-muted-foreground h-16 text-center">
        {t("le.noActivity")}
      </TableCell>
    </TableRow>
  )
}

function TrialBalanceView({ data, money }: { data?: TrialBalance; money: Money }) {
  const t = useT()
  const cols = ["openingDebit", "openingCredit", "periodDebit", "periodCredit", "closingDebit", "closingCredit"] as const
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{t("le.report.trial-balance")}</CardTitle>
        <Badge variant={data?.balanced ? "default" : "destructive"} data-testid="tb-balanced">
          {data?.balanced ? t("le.balanced") : t("le.difference", { amount: money(data?.difference) })}
        </Badge>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("acc.code")}</TableHead>
              <TableHead>{t("crm.name")}</TableHead>
              {cols.map((c) => (
                <TableHead key={c} className="text-right">
                  {t(`le.tb.${c}`)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <EmptyRow show={!data?.rows?.length} cols={8} />
            {(data?.rows ?? []).map((r) => (
              <TableRow key={r.accountId}>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell>{r.name}</TableCell>
                {cols.map((c) => (
                  <TableCell key={c} className="text-right">
                    {r[c] ? money(r[c]) : ""}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          {!!data?.rows?.length && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>{t("sales.total")}</TableCell>
                {cols.map((c) => (
                  <TableCell key={c} className="text-right font-semibold">
                    {money(data.totals?.[c])}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </CardContent>
    </Card>
  )
}

function GroupsCard({ title, groups, total, money }: { title: string; groups?: AmountGroup[]; total?: number; money: Money }) {
  const t = useT()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {!groups?.length && <p className="text-muted-foreground">{t("le.noActivity")}</p>}
        {(groups ?? []).map((g) => (
          <div key={g.typeCode ?? g.typeName} className="grid gap-1">
            <div className="flex justify-between font-medium">
              <span>{g.typeName}</span>
              <span>{money(g.total)}</span>
            </div>
            {(g.lines ?? []).map((l) => (
              <div key={l.accountId} className="text-muted-foreground flex justify-between pl-4">
                <span>
                  <span className="font-mono text-xs">{l.code}</span> {l.name}
                </span>
                <span>{money(l.amount)}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="flex justify-between border-t pt-2 font-semibold">
          <span>{t("sales.total")}</span>
          <span>{money(total)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function CashFlowView({ data, money }: { data?: CashFlow; money: Money }) {
  const t = useT()
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ["le.cash.opening", data?.openingCash],
            ["le.cash.netChange", data?.netChange],
            ["le.cash.closing", data?.closingCash],
          ] as const
        ).map(([k, v]) => (
          <Card key={k}>
            <CardHeader>
              <CardDescription>{t(k)}</CardDescription>
              <CardTitle className="text-xl">{money(v)}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      {(data?.sections ?? []).map((sec) => (
        <Card key={sec.activity}>
          <CardHeader>
            <CardTitle className="text-base">{t(`le.cash.${sec.activity}` as TranslationKey)}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("le.account")}</TableHead>
                  <TableHead className="text-right">{t("le.cash.inflow")}</TableHead>
                  <TableHead className="text-right">{t("le.cash.outflow")}</TableHead>
                  <TableHead className="text-right">{t("le.cash.net")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <EmptyRow show={!sec.lines?.length} cols={4} />
                {(sec.lines ?? []).map((l) => (
                  <TableRow key={l.accountId}>
                    <TableCell>
                      <span className="font-mono text-xs">{l.code}</span> {l.name}
                    </TableCell>
                    <TableCell className="text-right">{money(l.inflow)}</TableCell>
                    <TableCell className="text-right">{money(l.outflow)}</TableCell>
                    <TableCell className="text-right">{money(l.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>{t("sales.total")}</TableCell>
                  <TableCell className="text-right">{money(sec.inflow)}</TableCell>
                  <TableCell className="text-right">{money(sec.outflow)}</TableCell>
                  <TableCell className="text-right font-semibold">{money(sec.net)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function LedgerView({ data, money, language }: { data?: GeneralLedger; money: Money; language: string }) {
  const t = useT()
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <span className="font-mono">{data?.code}</span> {data?.name}
        </CardTitle>
        <CardDescription>
          {t("le.openingBalance")}: {money(data?.openingBalance)} · {t("le.closingBalance")}: <span data-testid="closing-balance">{money(data?.closingBalance)}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("pos.date")}</TableHead>
              <TableHead>{t("sales.number")}</TableHead>
              <TableHead>{t("acc.reference")}</TableHead>
              <TableHead>{t("le.description")}</TableHead>
              <TableHead>{t("le.counterpart")}</TableHead>
              <TableHead className="text-right">{t("le.debit")}</TableHead>
              <TableHead className="text-right">{t("le.credit")}</TableHead>
              <TableHead className="text-right">{t("acc.report.balance")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <EmptyRow show={!data?.lines?.length} cols={8} />
            {(data?.lines ?? []).map((l, i) => (
              <TableRow key={`${l.entryId}-${i}`}>
                <TableCell>{formatDate(l.date, language)}</TableCell>
                <TableCell className="font-mono text-xs">{l.number}</TableCell>
                <TableCell>{l.reference || "-"}</TableCell>
                <TableCell className="max-w-64 truncate" title={l.description}>
                  {l.description || "-"}
                </TableCell>
                <TableCell className="font-mono text-xs">{(l.counterpartCodes ?? []).join(", ")}</TableCell>
                <TableCell className="text-right">{l.debit ? money(l.debit) : ""}</TableCell>
                <TableCell className="text-right">{l.credit ? money(l.credit) : ""}</TableCell>
                <TableCell className="text-right font-medium">{money(l.balance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5}>{t("sales.total")}</TableCell>
              <TableCell className="text-right font-semibold">{money(data?.totalDebit)}</TableCell>
              <TableCell className="text-right font-semibold">{money(data?.totalCredit)}</TableCell>
              <TableCell className="text-right font-semibold">{money(data?.closingBalance)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  )
}
