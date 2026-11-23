"use client"

import * as React from "react"
import { CircleDollarSign, FileMinus, Handshake, Ticket } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCurrentUser } from "@/components/user-menu-content"
import { useMoney } from "@/hooks/use-money"
import { ModuleDashboardService as M, type ModuleDashboard, type PortalClientParts } from "@/lib/dashboard/dashboard.service"
import { formatNumber } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"

import { PartError, SectionCard, StatCard } from "./dashboard-kit"

/** ACC_098 = the account is not linked to a customer (Customer.userId): said once instead of per card */
const NOT_LINKED = "ACC_098"

/**
 * §5 role view Client (portal): GET /reports/client-dashboard?year → parts payments (accounting
 * /portal/client/payments/summary: totalSettled all time, monthly cleared payments of the year, credit notes),
 * deals {count} (crm portal), openTickets {count} (IN_PROGRESS + ON_HOLD portal tickets). Only my customer's rows.
 */
export function ClientDashboard() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const money = useMoney()
  const user = useCurrentUser()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = React.useState(currentYear)
  const [state, setState] = React.useState<{ year?: number; data?: ModuleDashboard<PortalClientParts>; error?: string }>({})
  React.useEffect(() => {
    let cancelled = false
    M.client(year)
      .then((data) => !cancelled && setState({ year, data }))
      .catch((e: Error) => !cancelled && setState({ year, error: e.message }))
    return () => {
      cancelled = true
    }
  }, [year])
  const current = state.year === year ? state : {}
  const loading = !current.data && !current.error
  const parts = current.data?.parts ?? {}
  const pay = parts.payments
  const notLinked = pay?.error === NOT_LINKED
  const n = (v?: number) => formatNumber(v ?? 0, language)
  const month = (m?: number) => new Date(2000, (m ?? 1) - 1, 1).toLocaleString(language, { month: "short" })
  const series = Array.from({ length: 12 }, (_, i) => ({
    month: month(i + 1),
    amount: pay?.data?.monthly?.find((x) => x.month === i + 1)?.amount ?? 0,
  }))
  const cfg = { amount: { label: t("portal.paid"), color: "var(--primary)" } } satisfies ChartConfig
  /** a stat whose part failed shows the reason as its hint (not linked: the banner says it) */
  const failed = (e?: string | null) => (e ? (e === NOT_LINKED ? undefined : <PartError error={e} />) : undefined)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6" data-testid="client-dashboard">
      <PageHeader title={t("dashboard.welcome", { name: user.name })} description={t("portal.clientSubtitle")}>
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

      {current.error && (
        <Alert variant="destructive">
          <AlertDescription>{current.error}</AlertDescription>
        </Alert>
      )}
      {notLinked && (
        <Alert data-testid="portal-not-linked">
          <AlertDescription>{t("portal.clientNotLinked")}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("portal.totalPaid")}
          value={pay?.data ? money(pay.data.totalSettled) : "-"}
          hint={pay?.error ? failed(pay.error) : t("portal.allTime")}
          icon={CircleDollarSign}
          loading={loading}
          testId="portal-total-paid"
        />
        <StatCard
          label={t("portal.creditNotes")}
          value={pay?.data ? money(pay.data.notesTotal) : "-"}
          hint={pay?.error ? failed(pay.error) : t("portal.notesCount", { n: n(pay?.data?.notesCount) })}
          icon={FileMinus}
          loading={loading}
          testId="portal-credit-notes"
        />
        <StatCard
          label={t("portal.deals")}
          value={parts.deals?.data ? n(parts.deals.data.count) : "-"}
          hint={failed(parts.deals?.error)}
          icon={Handshake}
          loading={loading}
          testId="portal-deals"
        />
        <StatCard
          label={t("portal.openTickets")}
          value={parts.openTickets?.data ? n(parts.openTickets.data.count) : "-"}
          hint={failed(parts.openTickets?.error)}
          icon={Ticket}
          loading={loading}
          testId="portal-open-tickets"
        />
      </div>

      {!notLinked && (
        <SectionCard title={t("portal.paymentsByMonth")} description={t("dash.byMonth", { year })} part={pay} loading={loading}>
          <ChartContainer config={cfg} className="h-64 w-full">
            <BarChart data={series}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => formatNumber(v, language)} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => money(Number(v))} />} />
              <Bar dataKey="amount" fill="var(--color-amount)" radius={4} />
            </BarChart>
          </ChartContainer>
        </SectionCard>
      )}
    </div>
  )
}
