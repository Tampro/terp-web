"use client"

import * as React from "react"
import { CircleDollarSign, FileMinus, FileText, Handshake, Ticket } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCurrentUser } from "@/components/user-menu-content"
import { useMoney } from "@/hooks/use-money"
import { ModuleDashboardService as M, type ModuleDashboard, type PortalParts } from "@/lib/dashboard/dashboard.service"
import { formatNumber } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"

import { PartError, SectionCard, StatCard } from "./dashboard-kit"

export type PortalKind = "client" | "vendor"

/** ACC_098 = the account is not linked to a customer / vendor (Customer.userId / Vendor.userId): said once */
const NOT_LINKED = "ACC_098"

/**
 * §5 role views Client and Vendor (portal), for a portal-only user. Client: GET /reports/client-dashboard?year →
 * payments (accounting /portal/client/payments/summary: totalSettled all time, monthly cleared payments of the year,
 * credit notes), deals {count}, openTickets {count}. Vendor: GET /reports/vendor-dashboard?year → payments (received
 * from the company, debit notes), purchaseInvoices {count}; requests is always NOT_AVAILABLE (not shown). Only the
 * rows of my customer / vendor. Both portal rights → one tab each.
 */
export function PortalDashboard({ kinds }: { kinds: PortalKind[] }) {
  const t = useT()
  const user = useCurrentUser()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = React.useState(currentYear)
  const [tab, setTab] = React.useState<PortalKind>(kinds[0] ?? "client")
  const subtitle = kinds.length === 1 && kinds[0] === "vendor" ? t("portal.vendorSubtitle") : t("portal.clientSubtitle")

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader title={t("dashboard.welcome", { name: user.name })} description={subtitle}>
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
      {kinds.length > 1 ? (
        <Tabs value={tab} onValueChange={(v) => setTab(v as PortalKind)}>
          <TabsList>
            {kinds.map((k) => (
              <TabsTrigger key={k} value={k}>
                {t(`portal.tab.${k}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          {kinds.map((k) => (
            <TabsContent key={k} value={k} className="mt-4">
              {tab === k && <PortalView kind={k} year={year} />}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <PortalView kind={kinds[0] ?? "client"} year={year} />
      )}
    </div>
  )
}

function PortalView({ kind, year }: { kind: PortalKind; year: number }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const money = useMoney()
  const [state, setState] = React.useState<{ year?: number; data?: ModuleDashboard<PortalParts>; error?: string }>({})
  React.useEffect(() => {
    let cancelled = false
    M[kind](year)
      .then((data) => !cancelled && setState({ year, data }))
      .catch((e: Error) => !cancelled && setState({ year, error: e.message }))
    return () => {
      cancelled = true
    }
  }, [kind, year])
  const current = state.year === year ? state : {}
  const loading = !current.data && !current.error
  const parts = current.data?.parts ?? {}
  const pay = parts.payments
  const notLinked = pay?.error === NOT_LINKED
  const client = kind === "client"
  const n = (v?: number) => formatNumber(v ?? 0, language)
  const month = (m?: number) => new Date(2000, (m ?? 1) - 1, 1).toLocaleString(language, { month: "short" })
  const series = Array.from({ length: 12 }, (_, i) => ({
    month: month(i + 1),
    amount: pay?.data?.monthly?.find((x) => x.month === i + 1)?.amount ?? 0,
  }))
  const cfg = { amount: { label: t(client ? "portal.paid" : "portal.received"), color: "var(--primary)" } } satisfies ChartConfig
  /** a stat whose part failed shows the reason as its hint (not linked: the banner says it) */
  const failed = (e?: string | null) => (e === NOT_LINKED ? undefined : <PartError error={e ?? ""} />)
  const count = (p?: { data?: { count?: number } | null; error?: string | null }) => (p?.data ? n(p.data.count) : "-")

  return (
    <div className="flex flex-col gap-6" data-testid={`${kind}-dashboard`}>
      {current.error && (
        <Alert variant="destructive">
          <AlertDescription>{current.error}</AlertDescription>
        </Alert>
      )}
      {notLinked && (
        <Alert data-testid="portal-not-linked">
          <AlertDescription>{t(client ? "portal.clientNotLinked" : "portal.vendorNotLinked")}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t(client ? "portal.totalPaid" : "portal.totalReceived")}
          value={pay?.data ? money(pay.data.totalSettled) : "-"}
          hint={pay?.error ? failed(pay.error) : t("portal.allTime")}
          icon={CircleDollarSign}
          loading={loading}
          testId="portal-total-paid"
        />
        <StatCard
          label={t(client ? "portal.creditNotes" : "portal.debitNotes")}
          value={pay?.data ? money(pay.data.notesTotal) : "-"}
          hint={pay?.error ? failed(pay.error) : t("portal.notesCount", { n: n(pay?.data?.notesCount) })}
          icon={FileMinus}
          loading={loading}
          testId="portal-notes"
        />
        {client ? (
          <>
            <StatCard
              label={t("portal.deals")}
              value={count(parts.deals)}
              hint={parts.deals?.error ? failed(parts.deals.error) : undefined}
              icon={Handshake}
              loading={loading}
              testId="portal-deals"
            />
            <StatCard
              label={t("portal.openTickets")}
              value={count(parts.openTickets)}
              hint={parts.openTickets?.error ? failed(parts.openTickets.error) : undefined}
              icon={Ticket}
              loading={loading}
              testId="portal-open-tickets"
            />
          </>
        ) : (
          <StatCard
            label={t("portal.purchaseInvoices")}
            value={count(parts.purchaseInvoices)}
            hint={parts.purchaseInvoices?.error ? failed(parts.purchaseInvoices.error) : undefined}
            icon={FileText}
            loading={loading}
            testId="portal-purchase-invoices"
          />
        )}
      </div>

      {!notLinked && (
        <SectionCard
          title={t(client ? "portal.paymentsByMonth" : "portal.receivedByMonth")}
          description={t("dash.byMonth", { year })}
          part={pay}
          loading={loading}
        >
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
