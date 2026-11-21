"use client"

import * as React from "react"
import { toast } from "sonner"

import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatDate, formatNumber } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import {
  SubscriptionService,
  type EBillingCycle,
  type PlanDto,
  type PlanModuleDto,
  type SubscriptionDto,
} from "@/lib/saas/saas.service"

import { CycleToggle, PlanCard } from "./plan-card"
import { SubscribeDialog } from "./subscribe-dialog"

const STATUS_KEY: Record<string, TranslationKey> = {
  NONE: "subscription.statusNONE",
  TRIAL: "subscription.statusTRIAL",
  ACTIVE: "subscription.statusACTIVE",
  EXPIRED: "subscription.statusEXPIRED",
}

/** §4.2 Plans for a company: current subscription, read-only comparison, Subscribe / Start Trial. */
export function CompanyPlans() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const canOrder = useAuthStore((s) => !!s.me?.permissions?.includes("SAAS_ORDER_CREATE"))
  const [cycle, setCycle] = React.useState<EBillingCycle>("MONTHLY")
  const [data, setData] = React.useState<{ plans: PlanDto[]; modules: PlanModuleDto[]; sub?: SubscriptionDto }>()
  const [error, setError] = React.useState<string>()
  const [reloadKey, setReloadKey] = React.useState(0)
  const [subscribing, setSubscribing] = React.useState<PlanDto>()
  const [trialing, setTrialing] = React.useState<string>()

  React.useEffect(() => {
    let cancelled = false
    Promise.all([SubscriptionService.plans(), SubscriptionService.modules(), SubscriptionService.current()])
      .then(([plans, modules, sub]) => !cancelled && setData({ plans: plans ?? [], modules: modules ?? [], sub }))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  async function startTrial(p: PlanDto) {
    if (!p.id) return
    setTrialing(p.id)
    try {
      await SubscriptionService.startTrial(p.id)
      toast.success(t("subscription.trialStarted", { name: p.name ?? "", n: p.trialDays ?? 0 }))
      setReloadKey((k) => k + 1)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setTrialing(undefined)
    }
  }

  const sub = data?.sub
  const currentId = sub?.plan?.id

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("plans.title")} description={t("subscription.subtitle")}>
        <CycleToggle value={cycle} onChange={setCycle} />
      </PageHeader>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {sub && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-sm">{t("subscription.currentPlan")}</p>
              <p className="text-lg font-semibold" data-testid="current-plan">
                {sub.plan?.name ?? t("subscription.noPlan")}
              </p>
              {sub.fallback && <p className="text-muted-foreground text-xs">{t("subscription.fallback")}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <Badge variant={sub.status === "EXPIRED" ? "destructive" : "secondary"}>
                {sub.status ? t(STATUS_KEY[sub.status] ?? "subscription.statusNONE") : "-"}
              </Badge>
              <span>
                {t("subscription.expires")}: <strong>{sub.expiresAt ? formatDate(sub.expiresAt, language) : t("subscription.noExpiry")}</strong>
              </span>
              <span>
                {t("subscription.users")}:{" "}
                <strong>
                  {formatNumber(sub.usedUsers, language)} /{" "}
                  {sub.plan?.maxUsers === null || sub.plan?.maxUsers === undefined ? "∞" : formatNumber(sub.plan.maxUsers, language)}
                </strong>
              </span>
            </div>
          </CardContent>
        </Card>
      )}
      {!data && !error && <Skeleton className="h-80" />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.plans.map((p) => {
          const current = p.id === currentId && sub?.status !== "EXPIRED"
          const unavailable = cycle === "YEARLY" && (p.yearlyPrice === null || p.yearlyPrice === undefined)
          return (
            <PlanCard
              key={p.id}
              plan={p}
              modules={data.modules}
              cycle={cycle}
              current={current}
              footer={
                canOrder && (
                  <>
                    <Button className="w-full" disabled={unavailable} onClick={() => setSubscribing(p)}>
                      {current ? t("subscription.renew") : t("subscription.subscribe")}
                    </Button>
                    {!!p.trialDays && !current && (
                      <Button variant="outline" className="w-full" disabled={trialing === p.id} onClick={() => startTrial(p)}>
                        {t("subscription.startTrial", { n: p.trialDays })}
                      </Button>
                    )}
                  </>
                )
              }
            />
          )
        })}
      </div>
      <SubscribeDialog
        plan={subscribing}
        cycle={cycle}
        onClose={() => setSubscribing(undefined)}
        onDone={() => setReloadKey((k) => k + 1)}
      />
    </div>
  )
}
