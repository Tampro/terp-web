"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Search } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { FieldError } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n"
import { getPlanSchema, toNumberOrNull, type TPlanSchema } from "@/lib/saas/saas.schema"
import { AdminPlanService, type PlanDto, type PlanModuleDto } from "@/lib/saas/saas.service"

const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v))

function toForm(p?: PlanDto): TPlanSchema {
  return {
    code: p?.code ?? "",
    name: p?.name ?? "",
    description: p?.description ?? "",
    monthlyPrice: str(p?.monthlyPrice ?? 0),
    yearlyPrice: str(p?.yearlyPrice),
    maxUsers: str(p?.maxUsers),
    maxEmployees: str(p?.maxEmployees),
    storageLimitGb: str(p?.storageLimitGb),
    trialDays: str(p?.trialDays),
    aiIntegration: !!p?.aiIntegration,
    defaultPlan: !!p?.defaultPlan,
    enabled: p?.enabled ?? true,
    recommended: !!p?.recommended,
    modules: p?.modules ?? [],
  }
}

/**
 * Create (POST) / edit (PUT, full replacement) a plan. Empty limit = unlimited (the backend reads an omitted limit as
 * unlimited); "defaultPlan" moves the default flag to this plan.
 */
export function PlanFormDialog({
  state,
  modules,
  onClose,
  onSaved,
}: {
  state: { plan?: PlanDto } | null
  modules: PlanModuleDto[]
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const editing = !!state?.plan?.id
  const form = useForm<TPlanSchema>({
    resolver: zodResolver(getPlanSchema(t)),
    mode: "all",
    values: toForm(state?.plan),
  })
  const { errors, isSubmitting } = form.formState
  const selected = useWatch({ control: form.control, name: "modules" })
  const [moduleSearch, setModuleSearch] = React.useState("")
  const visible = modules.filter((m) =>
    `${m.name ?? ""} ${m.code ?? ""}`.toLowerCase().includes(moduleSearch.trim().toLowerCase())
  )

  async function onSubmit(v: TPlanSchema) {
    const body = {
      code: v.code,
      name: v.name,
      description: v.description || null,
      monthlyPrice: Number(v.monthlyPrice),
      yearlyPrice: toNumberOrNull(v.yearlyPrice),
      maxUsers: toNumberOrNull(v.maxUsers),
      maxEmployees: toNumberOrNull(v.maxEmployees),
      storageLimitGb: toNumberOrNull(v.storageLimitGb),
      trialDays: toNumberOrNull(v.trialDays),
      aiIntegration: v.aiIntegration,
      defaultPlan: v.defaultPlan,
      enabled: v.enabled,
      recommended: v.recommended,
      modules: v.modules,
    }
    try {
      if (editing) await AdminPlanService.update(state!.plan!.id!, body)
      else await AdminPlanService.create(body)
      toast.success(t("common.saved"))
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const num = (name: keyof TPlanSchema, label: string, hint?: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`plan-${name}`}>{label}</Label>
      <Input id={`plan-${name}`} inputMode="decimal" {...form.register(name)} />
      {hint && !errors[name] && <p className="text-muted-foreground text-xs">{hint}</p>}
      <FieldError message={errors[name]?.message as string | undefined} />
    </div>
  )

  const toggle = (name: "enabled" | "recommended" | "defaultPlan" | "aiIntegration", label: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          {label}
          <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={label} />
        </label>
      )}
    />
  )

  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? t("plans.edit") : t("plans.create")}</DialogTitle>
          <DialogDescription>{t("plans.formDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="plan-name">{t("plans.name")}</Label>
              <Input id="plan-name" {...form.register("name")} />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="plan-code">{t("plans.code")}</Label>
              <Input id="plan-code" {...form.register("code")} />
              <FieldError message={errors.code?.message} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="plan-description">{t("plans.description")}</Label>
            <Textarea id="plan-description" rows={2} {...form.register("description")} />
            <FieldError message={errors.description?.message} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {num("monthlyPrice", t("plans.monthlyPrice"))}
            {num("yearlyPrice", t("plans.yearlyPrice"), t("plans.noYearlyHint"))}
            {num("trialDays", t("plans.trialDays"), t("plans.noTrialHint"))}
            {num("maxUsers", t("plans.maxUsers"), t("plans.unlimitedHint"))}
            {num("maxEmployees", t("plans.maxEmployees"), t("plans.unlimitedHint"))}
            {num("storageLimitGb", t("plans.storageGb"), t("plans.unlimitedHint"))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {toggle("enabled", t("plans.active"))}
            {toggle("recommended", t("plans.recommended"))}
            {toggle("defaultPlan", t("plans.defaultPlan"))}
            {toggle("aiIntegration", t("plans.ai"))}
          </div>

          <fieldset className="grid gap-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">
              {t("plans.modules")} <span className="text-muted-foreground">({t("plans.selectedCount", { n: selected.length, total: modules.length })})</span>
            </legend>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-48 flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  className="pl-9"
                  value={moduleSearch}
                  onChange={(e) => setModuleSearch(e.target.value)}
                  placeholder={t("plans.searchModules")}
                  aria-label={t("plans.searchModules")}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  form.setValue(
                    "modules",
                    selected.length === modules.length ? [] : modules.map((m) => m.code!).filter(Boolean),
                    { shouldDirty: true }
                  )
                }
              >
                {selected.length === modules.length ? t("plans.uncheckAll") : t("plans.checkAll")}
              </Button>
            </div>
            <div className="grid max-h-60 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((m) => {
                const code = m.code ?? ""
                const checked = selected.includes(code)
                return (
                  <label key={code} className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) =>
                        form.setValue("modules", v ? [...selected, code] : selected.filter((x) => x !== code), {
                          shouldDirty: true,
                        })
                      }
                    />
                    <span className="truncate">{m.name ?? code}</span>
                  </label>
                )
              })}
              {visible.length === 0 && <p className="text-muted-foreground text-sm">{t("common.noData")}</p>}
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
