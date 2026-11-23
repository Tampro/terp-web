"use client"

import * as React from "react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useMoney } from "@/hooks/use-money"
import { CompanyService, type CompanyDto, type CompanyInfoDto } from "@/lib/admin/admin.service"
import { formatDate, formatNumber } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"
import { AdminPlanService, type PlanDto } from "@/lib/saas/saas.service"

/** Company info panel (GET /iam/companies/{id}/info): profile, plan, accounts vs the plan limit, administrators. */
export function CompanyInfoDialog({ company, onOpenChange }: { company?: CompanyDto; onOpenChange: (open: boolean) => void }) {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const [state, setState] = React.useState<{ id?: string; info?: CompanyInfoDto; error?: string }>({})
  const id = company?.id
  React.useEffect(() => {
    if (!id) return
    let cancelled = false
    CompanyService.info(id)
      .then((info) => !cancelled && setState({ id, info }))
      .catch((e: Error) => !cancelled && setState({ id, error: e.message }))
    return () => {
      cancelled = true
    }
  }, [id])
  // the result of another company stays hidden while this one loads
  const current = state.id === id ? state : {}
  const c = current.info?.company
  const users = current.info?.userCount
  const max = current.info?.maxUsers
  return (
    <Dialog open={!!company} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{company?.name}</DialogTitle>
          <DialogDescription>{company?.code}</DialogDescription>
        </DialogHeader>
        {current.error && (
          <Alert variant="destructive">
            <AlertDescription>{current.error}</AlertDescription>
          </Alert>
        )}
        {!current.info && !current.error && <Skeleton className="h-48" />}
        {current.info && (
          <div className="grid gap-4 text-sm" data-testid="company-info">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">{t("companies.email")}</dt>
              <dd className="break-all">{c?.email ?? "-"}</dd>
              <dt className="text-muted-foreground">{t("companies.loginStatus")}</dt>
              <dd>
                <Badge variant={c?.status === "ACTIVE" ? "secondary" : "outline"}>{c?.status === "ACTIVE" ? t("companies.enabled") : t("companies.disabled")}</Badge>
              </dd>
              <dt className="text-muted-foreground">{t("companies.plan")}</dt>
              <dd>
                {c?.planName ?? "-"}
                {c?.planExpiresAt && <span className="text-muted-foreground ml-1 text-xs">({t("companies.expires", { date: formatDate(c.planExpiresAt, language) })})</span>}
              </dd>
              <dt className="text-muted-foreground">{t("companies.accounts")}</dt>
              <dd data-testid="company-accounts">
                {max == null ? t("companies.accountsUnlimited", { n: formatNumber(users, language) }) : t("companies.accountsOf", { n: formatNumber(users, language), max: formatNumber(max, language) })}
                {max != null && (users ?? 0) >= max && (
                  <Badge variant="destructive" className="ml-2">
                    {t("companies.limitReached")}
                  </Badge>
                )}
              </dd>
              <dt className="text-muted-foreground">{t("companies.createdAt")}</dt>
              <dd>{formatDate(c?.createdDate, language)}</dd>
              {c?.referralCode && (
                <>
                  <dt className="text-muted-foreground">{t("companies.referralCode")}</dt>
                  <dd className="font-mono">{c.referralCode}</dd>
                </>
              )}
            </dl>
            <div className="grid gap-2">
              <p className="font-medium">{t("companies.administrators")}</p>
              {!current.info.administrators?.length && <p className="text-muted-foreground">{t("common.noData")}</p>}
              <ul className="grid gap-2">
                {current.info.administrators?.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{u.fullName || u.username}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {u.username} · {u.email}
                      </p>
                    </div>
                    {u.status && <Badge variant="outline">{u.status === "ACTIVE" ? t("companies.userActive") : t("companies.userInactive")}</Badge>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

type Cycle = "MONTHLY" | "YEARLY"

/**
 * Upgrade plan (PUT /iam/companies/{id}/plan {planId, billingCycle}): one billing cycle from now, or the running period
 * of the same plan extended; recorded as an APPROVED MANUAL order. Only enabled plans; YEARLY needs a yearly price
 * (SAAS_003).
 */
export function UpgradePlanDialog({ company, onOpenChange, onDone }: { company?: CompanyDto; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const t = useT()
  const money = useMoney()
  const [plans, setPlans] = React.useState<PlanDto[]>()
  const [planId, setPlanId] = React.useState("")
  const [cycle, setCycle] = React.useState<Cycle>("MONTHLY")
  const [busy, setBusy] = React.useState(false)
  const open = !!company
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    AdminPlanService.list()
      .then((p) => !cancelled && setPlans((p ?? []).filter((x) => x.enabled !== false)))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [open])
  const plan = plans?.find((p) => p.id === planId)
  const noYearly = !!plan && plan.yearlyPrice == null
  const effectiveCycle: Cycle = noYearly ? "MONTHLY" : cycle
  const price = plan ? (effectiveCycle === "YEARLY" ? plan.yearlyPrice : plan.monthlyPrice) : undefined
  const same = !!plan && plan.id === company?.planId
  const close = (o: boolean) => {
    if (!o) {
      setPlanId("")
      setCycle("MONTHLY")
    }
    onOpenChange(o)
  }
  const submit = async () => {
    if (!company?.id || !plan?.id) return
    setBusy(true)
    try {
      await CompanyService.upgradePlan(company.id, { planId: Number(plan.id), billingCycle: effectiveCycle })
      toast.success(t("companies.planUpgraded", { name: company.name ?? "", plan: plan.name ?? "" }))
      close(false)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("companies.upgradePlan")}</DialogTitle>
          <DialogDescription>{t("companies.upgradeHint", { name: company?.name ?? "", plan: company?.planName ?? "-" })}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="upgrade-plan">{t("companies.plan")}</Label>
            <Select value={planId} onValueChange={setPlanId} disabled={!plans}>
              <SelectTrigger id="upgrade-plan" className="w-full" aria-label={t("companies.plan")}>
                <SelectValue placeholder={t("companies.choosePlan")} />
              </SelectTrigger>
              <SelectContent>
                {plans?.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                    {p.id === company?.planId ? ` (${t("companies.currentPlan")})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="upgrade-cycle">{t("companies.billingCycle")}</Label>
            <Select value={effectiveCycle} onValueChange={(v) => setCycle(v as Cycle)}>
              <SelectTrigger id="upgrade-cycle" className="w-full" aria-label={t("companies.billingCycle")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MONTHLY">{t("companies.monthly")}</SelectItem>
                <SelectItem value="YEARLY" disabled={noYearly}>
                  {t("companies.yearly")}
                </SelectItem>
              </SelectContent>
            </Select>
            {noYearly && <p className="text-muted-foreground text-xs">{t("companies.noYearly")}</p>}
          </div>
          {plan && (
            <Alert>
              <AlertDescription data-testid="upgrade-summary">
                {t(same ? "companies.upgradeExtend" : "companies.upgradeMove", { price: money(price), cycle: t(effectiveCycle === "YEARLY" ? "companies.cycleYear" : "companies.cycleMonth") })}
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={busy || !plan}>
            {t("companies.upgradeConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
