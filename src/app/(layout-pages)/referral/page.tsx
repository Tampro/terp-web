"use client"

import * as React from "react"
import { Check, Copy, HandCoins, Link2, ThumbsDown, ThumbsUp } from "lucide-react"
import { toast } from "sonner"

import { FieldError } from "@/components/auth/password-input"
import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useMoney } from "@/hooks/use-money"
import { formatDate, formatNumber } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { PAYOUT_STATUSES, ReferralAdminService as A, ReferralService as C, type MyReferral, type ReferralDashboard, type ReferredCompany } from "@/lib/referral/referral.service"

import { CrudSection, errorMessage, TabbedPage, useAuthStore, type CrudConfig } from "../hrm/_components/crud-kit"

export default function ReferralPage() {
  return (
    <React.Suspense>
      <Referral />
    </React.Suspense>
  )
}

/**
 * Referral program. One route: the super admin manages the program (dashboard, referred companies, payout requests,
 * settings); a company user (SAAS_ORDER_VIEW) sees their code, the rules and their balance, and requests payouts
 * (SAAS_ORDER_CREATE). Spec: lib/referral/referral.service.ts.
 */
function Referral() {
  const t = useT()
  const me = useAuthStore((s) => s.me)
  if (!me) return <Skeleton className="h-96" />
  if (!me.superAdmin) return <CompanyReferral canRequest={!!me.permissions?.includes("SAAS_ORDER_CREATE")} />
  return (
    <TabbedPage
      title={t("menu.referral")}
      description={t("ref.subtitleAdmin")}
      tabs={[
        { key: "dashboard", label: "ref.tab.dashboard", content: () => <Dashboard /> },
        { key: "referred", label: "ref.tab.referred", content: () => <Referred /> },
        { key: "payouts", label: "ref.tab.payouts", content: () => <Payouts /> },
        { key: "settings", label: "ref.tab.settings", content: () => <Settings /> },
      ]}
    />
  )
}

function useLoad<T>(load: () => Promise<T>, key = 0) {
  const [state, setState] = React.useState<{ data?: T; error?: string }>({})
  React.useEffect(() => {
    let cancelled = false
    load()
      .then((data) => !cancelled && setState({ data }))
      .catch((e) => !cancelled && setState({ error: errorMessage(e) }))
    return () => {
      cancelled = true
    }
    // load is a module-level service call
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state
}

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <Card>
      <CardContent className="grid gap-1">
        <span className="text-muted-foreground text-sm">{label}</span>
        <span className="text-2xl font-semibold" data-testid={testId}>
          {value}
        </span>
      </CardContent>
    </Card>
  )
}

function Dashboard() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const { data, error } = useLoad<ReferralDashboard>(A.dashboard)
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  if (!data) return <Skeleton className="h-64" />
  const n = (v?: number) => formatNumber(v ?? 0, language)
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label={t("ref.totalReferred")} value={n(data.totalReferredCompanies)} testId="ref-total-referred" />
        <Stat label={t("ref.activeReferred")} value={n(data.activeReferredCompanies)} />
        <Stat label={t("ref.signupsThisYear")} value={n(data.referralSignupsThisYear)} />
        <Stat label={t("ref.pendingPayouts")} value={money(data.pendingPayouts ?? 0)} testId="ref-pending" />
        <Stat label={t("ref.commissionPaid")} value={money(data.totalCommissionPaid ?? 0)} />
        <Stat label={t("ref.payoutsThisYear")} value={money(data.payoutsProcessedThisYear ?? 0)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("ref.topReferrers")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!data.topReferrers?.length ? (
            <p className="text-muted-foreground text-sm">{t("common.noData")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("ref.company")}</TableHead>
                  <TableHead className="text-right">{t("ref.referrals")}</TableHead>
                  <TableHead className="text-right">{t("ref.commissionEarned")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topReferrers.map((r) => (
                  <TableRow key={r.companyId}>
                    <TableCell>
                      <div className="font-medium">{r.companyName}</div>
                      <div className="text-muted-foreground text-xs">{r.companyEmail}</div>
                    </TableCell>
                    <TableCell className="text-right">{n(r.referrals)}</TableCell>
                    <TableCell className="text-right">{money(r.commissionEarned ?? 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Referred() {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const summary = useLoad(A.referredSummary)
  const [viewing, setViewing] = React.useState<ReferredCompany>()
  const cfg: CrudConfig = {
    id: "referred",
    load: A.referred as CrudConfig["load"],
    keyword: true,
    manage: false,
    rowName: (r) => String(r.companyName ?? ""),
    emptyLabel: "ref.noReferred",
    onRowClick: (r) => setViewing(r as ReferredCompany),
    columns: [
      { label: "ref.company", render: (r) => <span><span className="font-medium">{String(r.companyName ?? "-")}</span><span className="text-muted-foreground block text-xs">{String(r.companyEmail ?? "")}</span></span> },
      { label: "ref.registered", path: "registeredAt", kind: "date" },
      { label: "ref.referrer", path: "referrerName" },
      { label: "ref.plan", render: (r) => <span>{String(r.planName ?? "-")}{r.planMonthlyPrice != null && <span className="text-muted-foreground block text-xs">{money(Number(r.planMonthlyPrice))} / {t("ref.month")}</span>}</span> },
      { label: "ref.commission", render: (r) => money(Number(r.commission ?? 0)) },
    ],
  }
  return (
    <div className="grid gap-4">
      {summary.data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label={t("ref.totalReferred")} value={formatNumber(summary.data.totalReferred ?? 0, language)} />
          <Stat label={t("ref.withPlans")} value={formatNumber(summary.data.withPlans ?? 0, language)} />
          <Stat label={t("ref.totalCommission")} value={money(summary.data.totalCommission ?? 0)} />
        </div>
      )}
      <CrudSection config={cfg} />
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(undefined)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{viewing?.companyName}</DialogTitle>
            <DialogDescription>{t("ref.historyOf", { referrer: viewing?.referrerName ?? "-" })}</DialogDescription>
          </DialogHeader>
          {!viewing?.commissionHistory?.length ? (
            <p className="text-muted-foreground text-sm">{t("ref.noCommission")}</p>
          ) : (
            <Table data-testid="ref-history">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("ref.date")}</TableHead>
                  <TableHead className="text-right">{t("ref.orderAmount")}</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">{t("ref.commission")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewing.commissionHistory.map((c) => (
                  <TableRow key={c.orderId}>
                    <TableCell>{formatDate(c.createdDate, language)}</TableCell>
                    <TableCell className="text-right">{money(c.orderAmount ?? 0)}</TableCell>
                    <TableCell className="text-right">{formatNumber(c.commissionPercentage ?? 0, language, 2)}</TableCell>
                    <TableCell className="text-right">{money(c.amount ?? 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Payouts() {
  const money = useMoney()
  const cfg: CrudConfig = {
    id: "ref-payouts",
    load: A.payouts as CrudConfig["load"],
    keyword: true,
    manage: true,
    statuses: [...PAYOUT_STATUSES],
    rowName: (r) => `${r.companyName ?? ""} · ${money(Number(r.amount ?? 0))}`,
    emptyLabel: "ref.noPayouts",
    columns: [
      { label: "ref.company", render: (r) => <span><span className="font-medium">{String(r.companyName ?? "-")}</span><span className="text-muted-foreground block text-xs">{String(r.companyEmail ?? "")}</span></span> },
      { label: "ref.amount", render: (r) => <span data-testid="payout-amount">{money(Number(r.amount ?? 0))}</span> },
      { label: "ref.status", path: "status", kind: "status" },
      { label: "ref.requested", path: "createdDate", kind: "date" },
      { label: "ref.processed", path: "processedAt", kind: "date" },
    ],
    actions: [
      { key: "approve", label: "ref.approve", icon: <ThumbsUp />, when: (r) => r.status === "PENDING", confirmDesc: "ref.approveDesc", run: (r) => A.approve(String(r.id)) },
      { key: "reject", label: "ref.reject", icon: <ThumbsDown />, when: (r) => r.status === "PENDING", confirmDesc: "ref.rejectDesc", destructive: true, run: (r) => A.reject(String(r.id)) },
    ],
  }
  return <CrudSection config={cfg} />
}

function Settings() {
  const t = useT()
  const [reload, setReload] = React.useState(0)
  const { data, error } = useLoad(A.settings, reload)
  const [form, setForm] = React.useState<{ enabled: boolean; commissionPercentage: string; thresholdAmount: string; guidelines: string }>()
  const [busy, setBusy] = React.useState(false)
  const [loadedFor, setLoadedFor] = React.useState<unknown>()
  if (data && data !== loadedFor) {
    setLoadedFor(data)
    setForm({ enabled: !!data.enabled, commissionPercentage: String(data.commissionPercentage ?? 0), thresholdAmount: String(data.thresholdAmount ?? 0), guidelines: data.guidelines ?? "" })
  }
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  if (!form) return <Skeleton className="h-64" />
  const pct = Number(form.commissionPercentage)
  const min = Number(form.thresholdAmount)
  const errors = {
    pct: form.commissionPercentage.trim() === "" || Number.isNaN(pct) || pct < 0 || pct > 100 ? t("ref.pctBad") : undefined,
    min: form.thresholdAmount.trim() === "" || Number.isNaN(min) || min < 0 ? t("ref.minBad") : undefined,
  }
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (errors.pct || errors.min) return
    setBusy(true)
    try {
      await A.saveSettings({ enabled: form.enabled, commissionPercentage: pct, thresholdAmount: min, guidelines: form.guidelines.trim() || undefined })
      toast.success(t("common.saved"))
      setReload((k) => k + 1)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <form onSubmit={save} noValidate>
        <CardHeader>
          <CardTitle>{t("ref.tab.settings")}</CardTitle>
          <CardDescription>{t("ref.settingsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            {t("ref.enabled")}
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} aria-label={t("ref.enabled")} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ref-pct">{t("ref.percentage")}</Label>
              <Input id="ref-pct" inputMode="decimal" value={form.commissionPercentage} onChange={(e) => setForm({ ...form, commissionPercentage: e.target.value })} />
              <p className="text-muted-foreground text-xs">{t("ref.percentageHint")}</p>
              <FieldError message={errors.pct} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ref-min">{t("ref.threshold")}</Label>
              <Input id="ref-min" inputMode="decimal" value={form.thresholdAmount} onChange={(e) => setForm({ ...form, thresholdAmount: e.target.value })} />
              <FieldError message={errors.min} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ref-guidelines">{t("ref.guidelines")}</Label>
            <Textarea id="ref-guidelines" rows={6} maxLength={10000} value={form.guidelines} onChange={(e) => setForm({ ...form, guidelines: e.target.value })} />
            <p className="text-muted-foreground text-xs">{t("ref.guidelinesHint")}</p>
          </div>
          <div className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={busy}>
              {t("common.save")}
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  )
}

function CompanyReferral({ canRequest }: { canRequest: boolean }) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const [reload, setReload] = React.useState(0)
  const { data, error } = useLoad<MyReferral>(C.mine, reload)
  const [copied, setCopied] = React.useState<"code" | "link">()
  const [requesting, setRequesting] = React.useState(false)
  // the sign-up page fills the code in from ?ref=
  const link = data?.referralCode && typeof window !== "undefined" ? `${window.location.origin}/register?ref=${encodeURIComponent(data.referralCode)}` : ""
  const copy = async (what: "code" | "link") => {
    const text = what === "code" ? data?.referralCode : link
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(undefined), 1500)
    } catch {
      toast.error(t("ref.copyFailed"))
    }
  }
  const cfg: CrudConfig = {
    id: "my-payouts",
    load: C.payouts as CrudConfig["load"],
    manage: false,
    reloadKey: reload,
    rowName: (r) => money(Number(r.amount ?? 0)),
    emptyLabel: "ref.noPayouts",
    columns: [
      { label: "ref.amount", render: (r) => money(Number(r.amount ?? 0)) },
      { label: "ref.status", path: "status", kind: "status" },
      { label: "ref.requested", path: "createdDate", kind: "date" },
      { label: "ref.processed", path: "processedAt", kind: "date" },
    ],
  }
  return (
    <div className="grid gap-4">
      <PageHeader title={t("menu.referral")} description={t("ref.subtitle")}>
        {canRequest && data?.programEnabled && (
          <Button onClick={() => setRequesting(true)}>
            <HandCoins /> {t("ref.requestPayout")}
          </Button>
        )}
      </PageHeader>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {!data && !error && <Skeleton className="h-64" />}
      {data && (
        <>
          {!data.programEnabled && (
            <Alert>
              <AlertDescription>{t("ref.programOff")}</AlertDescription>
            </Alert>
          )}
          <Card>
            <CardHeader>
              <CardTitle>{t("ref.yourCode")}</CardTitle>
              <CardDescription>{t("ref.codeHint", { pct: formatNumber(data.commissionPercentage ?? 0, language, 2), min: money(data.thresholdAmount ?? 0) })}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <code className="bg-muted rounded-md px-4 py-2 text-xl font-semibold tracking-wider" data-testid="ref-code">
                {data.referralCode ?? "-"}
              </code>
              <Button variant="outline" onClick={() => copy("code")} aria-label={t("ref.copy")}>
                {copied === "code" ? <Check /> : <Copy />} {copied === "code" ? t("ref.copied") : t("ref.copy")}
              </Button>
              <Button variant="outline" onClick={() => copy("link")} disabled={!link} aria-label={t("ref.copyLink")}>
                {copied === "link" ? <Check /> : <Link2 />} {copied === "link" ? t("ref.copied") : t("ref.copyLink")}
              </Button>
              {link && (
                <code className="text-muted-foreground w-full text-xs break-all" data-testid="ref-link">
                  {link}
                </code>
              )}
            </CardContent>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Stat label={t("ref.referredCompanies")} value={formatNumber(data.referredCompanies ?? 0, language)} />
            <Stat label={t("ref.totalEarned")} value={money(data.totalEarned ?? 0)} />
            <Stat label={t("ref.paidOut")} value={money(data.paidOut ?? 0)} />
            <Stat label={t("ref.pendingPayout")} value={money(data.pendingPayout ?? 0)} />
            <Stat label={t("ref.available")} value={money(data.availableBalance ?? 0)} testId="ref-available" />
          </div>
          {data.guidelines && (
            <Card>
              <CardHeader>
                <CardTitle>{t("ref.guidelines")}</CardTitle>
              </CardHeader>
              {/* stored as given: shown as text */}
              <CardContent className="text-sm whitespace-pre-line" data-testid="ref-guidelines">
                {data.guidelines}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>{t("ref.myPayouts")}</CardTitle>
            </CardHeader>
            <CardContent>
              <CrudSection config={cfg} />
            </CardContent>
          </Card>
          <PayoutDialog open={requesting} mine={data} onClose={() => setRequesting(false)} onDone={() => setReload((k) => k + 1)} />
        </>
      )}
    </div>
  )
}

function PayoutDialog({ open, mine, onClose, onDone }: { open: boolean; mine: MyReferral; onClose: () => void; onDone: () => void }) {
  const t = useT()
  const money = useMoney()
  const [amount, setAmount] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const available = mine.availableBalance ?? 0
  const min = mine.thresholdAmount ?? 0
  const value = Number(amount)
  const err: TranslationKey | undefined =
    mine.pendingPayout && mine.pendingPayout > 0
      ? "ref.hasPending"
      : available < min
        ? "ref.notEnough"
        : amount.trim() === "" || Number.isNaN(value) || value <= 0
          ? undefined
          : value < min
            ? "ref.belowMin"
            : value > available
              ? "ref.aboveAvailable"
              : undefined
  const submit = async () => {
    if (err || !(value > 0)) return
    setBusy(true)
    try {
      await C.requestPayout(value)
      toast.success(t("ref.requestSent"))
      setAmount("")
      onClose()
      onDone()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("ref.requestPayout")}</DialogTitle>
          <DialogDescription>{t("ref.requestHint", { available: money(available), min: money(min) })}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="payout-amount">{t("ref.amount")}</Label>
          <div className="flex gap-2">
            <Input id="payout-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Button type="button" variant="outline" disabled={available <= 0} onClick={() => setAmount(String(available))}>
              {t("ref.all")}
            </Button>
          </div>
          <FieldError message={err ? t(err, { min: money(min), available: money(available) }) : undefined} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={busy || !!err || !(value > 0)}>
            {t("ref.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
