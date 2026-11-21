"use client"

import * as React from "react"
import { MoreHorizontal, Pencil, Plus, Power, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useT } from "@/lib/i18n"
import { AdminPlanService, SubscriptionService, type EBillingCycle, type PlanDto, type PlanModuleDto } from "@/lib/saas/saas.service"

import { CycleToggle, PlanCard } from "./plan-card"
import { PlanFormDialog } from "./plan-form-dialog"

/** §4.1 Plans (Super Admin): every plan, enabled or not. */
export function AdminPlans() {
  const t = useT()
  const [plans, setPlans] = React.useState<PlanDto[]>()
  const [modules, setModules] = React.useState<PlanModuleDto[]>([])
  const [error, setError] = React.useState<string>()
  const [cycle, setCycle] = React.useState<EBillingCycle>("MONTHLY")
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((k) => k + 1)
  const [editing, setEditing] = React.useState<{ plan?: PlanDto } | null>(null)
  const [deleting, setDeleting] = React.useState<PlanDto>()

  React.useEffect(() => {
    let cancelled = false
    Promise.all([AdminPlanService.list(), SubscriptionService.modules()])
      .then(([p, m]) => {
        if (cancelled) return
        setPlans(p ?? [])
        setModules(m ?? [])
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  async function toggle(p: PlanDto) {
    if (!p.id) return
    try {
      await AdminPlanService.setEnabled(p.id, !p.enabled)
      toast.success(p.enabled ? t("plans.disabledToast") : t("plans.enabledToast"))
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("plans.title")} description={t("plans.subtitle")}>
        <CycleToggle value={cycle} onChange={setCycle} />
        <Button onClick={() => setEditing({})}>
          <Plus className="size-4" /> {t("plans.create")}
        </Button>
      </PageHeader>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!plans && !error && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      )}
      {plans?.length === 0 && <p className="text-muted-foreground">{t("plans.empty")}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans?.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            modules={modules}
            cycle={cycle}
            actions={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t("plans.actionsFor", { name: p.name ?? "" })}>
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditing({ plan: p })}>
                    <Pencil className="size-4" /> {t("common.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggle(p)}>
                    <Power className="size-4" /> {p.enabled ? t("plans.disable") : t("plans.enable")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {/* The default plan cannot be deleted (SAAS_013) */}
                  <DropdownMenuItem variant="destructive" disabled={!!p.defaultPlan} onClick={() => setDeleting(p)}>
                    <Trash2 className="size-4" /> {t("common.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
        ))}
      </div>

      <PlanFormDialog state={editing} modules={modules} onClose={() => setEditing(null)} onSaved={reload} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("plans.deleteTitle", { name: deleting?.name ?? "" })}
        description={t("plans.deleteDesc")}
        onConfirm={async () => {
          if (!deleting?.id) return
          try {
            await AdminPlanService.remove(deleting.id)
            toast.success(t("plans.deleted"))
            reload()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
          }
        }}
      />
    </div>
  )
}
