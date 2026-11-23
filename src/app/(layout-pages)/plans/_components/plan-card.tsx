"use client"

import { Check, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useMoney } from "@/hooks/use-money"
import { formatNumber } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"
import type { EBillingCycle, PlanDto, PlanModuleDto } from "@/lib/saas/saas.service"
import { cn } from "@/lib/utils"

/** Plan card: price for the cycle, limits (null = unlimited), trial, and a ✓/✗ module list. */
export function PlanCard({
  plan,
  modules,
  cycle,
  current,
  actions,
  footer,
}: {
  plan: PlanDto
  modules: PlanModuleDto[]
  cycle: EBillingCycle
  current?: boolean
  actions?: React.ReactNode
  footer?: React.ReactNode
}) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const price = cycle === "YEARLY" ? plan.yearlyPrice : plan.monthlyPrice
  const limit = (n: number | null | undefined) => (n === null || n === undefined ? t("plans.unlimited") : formatNumber(n, language))
  const included = new Set(plan.modules ?? [])

  return (
    <Card className={cn("flex flex-col", (plan.recommended || plan.badge) && "border-primary ring-primary/30 ring-2", !plan.enabled && "opacity-70")}>
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{plan.name ?? "-"}</CardTitle>
          {actions}
        </div>
        <div className="flex flex-wrap gap-1">
          {/* a custom badge replaces the Recommended one (SaasDtos.PlanForm.badge) */}
          {plan.badge ? <Badge data-testid="plan-badge">{plan.badge}</Badge> : plan.recommended && <Badge>{t("plans.mostPopular")}</Badge>}
          {plan.free && <Badge variant="secondary">{t("plans.free")}</Badge>}
          {plan.defaultPlan && <Badge variant="secondary">{t("plans.defaultPlan")}</Badge>}
          {current && <Badge variant="secondary">{t("subscription.currentPlan")}</Badge>}
          {plan.enabled === false && <Badge variant="outline">{t("plans.inactive")}</Badge>}
          {!!plan.trialDays && <Badge variant="outline">{t("plans.trialBadge", { n: plan.trialDays })}</Badge>}
        </div>
        {plan.description && <p className="text-muted-foreground text-sm">{plan.description}</p>}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div>
          {price === null || price === undefined ? (
            <span className="text-muted-foreground text-sm">{t("plans.noYearly")}</span>
          ) : (
            <>
              <span className="text-2xl font-bold" data-testid="plan-price">
                {price === 0 ? t("plans.free") : money(price)}
              </span>
              {price !== 0 && (
                <span className="text-muted-foreground text-sm"> / {cycle === "YEARLY" ? t("plans.perYear") : t("plans.perMonth")}</span>
              )}
            </>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t("plans.maxUsers")}</dt>
          <dd>{limit(plan.maxUsers)}</dd>
          <dt className="text-muted-foreground">{t("plans.maxEmployees")}</dt>
          <dd>{limit(plan.maxEmployees)}</dd>
          <dt className="text-muted-foreground">{t("plans.storage")}</dt>
          <dd>{plan.storageLimitGb === null || plan.storageLimitGb === undefined ? t("plans.unlimited") : `${formatNumber(plan.storageLimitGb, language, 2)} GB`}</dd>
        </dl>
        {modules.length > 0 && (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs" aria-label={t("plans.modules")}>
            {modules.map((m) => {
              const on = included.has(m.code ?? "")
              return (
                <li key={m.code} className={cn("flex items-center gap-2", !on && "text-muted-foreground")}>
                  {on ? <Check className="size-4 text-emerald-500" aria-label={t("plans.included")} /> : <X className="size-4" aria-label={t("plans.notIncluded")} />}
                  {m.name ?? m.code}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
      {footer && <CardFooter className="flex flex-col gap-2">{footer}</CardFooter>}
    </Card>
  )
}

/** Monthly / Yearly switch shared by the plan pages. */
export function CycleToggle({ value, onChange }: { value: EBillingCycle; onChange: (v: EBillingCycle) => void }) {
  const t = useT()
  return (
    <div role="radiogroup" aria-label={t("plans.cycle")} className="bg-muted inline-flex rounded-lg p-1 text-sm">
      {(["MONTHLY", "YEARLY"] as const).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          onClick={() => onChange(c)}
          className={cn("rounded-md px-3 py-1", value === c && "bg-background font-medium shadow-sm")}
        >
          {c === "MONTHLY" ? t("plans.monthly") : t("plans.yearly")}
        </button>
      ))}
    </div>
  )
}
