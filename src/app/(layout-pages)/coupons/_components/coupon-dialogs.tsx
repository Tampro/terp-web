"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { FieldError } from "@/components/auth/password-input"
import { OrderStatusBadge } from "@/components/common/order-status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useMoney } from "@/hooks/use-money"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"
import { getCouponSchema, toNumberOrNull, type TCouponSchema } from "@/lib/saas/saas.schema"
import { CouponService, type CouponDto, type CouponUsageDto } from "@/lib/saas/saas.service"

const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v))

function toForm(c?: CouponDto): TCouponSchema {
  return {
    name: c?.name ?? "",
    type: c?.type ?? "PERCENTAGE",
    discountValue: str(c?.discountValue),
    codeGeneration: c ? "MANUAL" : "MANUAL",
    code: c?.code ?? "",
    minimumSpend: str(c?.minimumSpend),
    maximumSpend: str(c?.maximumSpend),
    useLimitTotal: str(c?.useLimitTotal),
    useLimitPerCompany: str(c?.useLimitPerCompany),
    expiryDate: c?.expiryDate?.slice(0, 10) ?? "",
    enabled: c?.enabled ?? true,
    description: c?.description ?? "",
  }
}

/**
 * §4.4 Add / edit a coupon. AUTO lets the backend generate an 8-character code (on edit: keeps the current one).
 * PUT is a full replacement: an empty limit becomes unlimited.
 */
export function CouponFormDialog({
  state,
  onClose,
  onSaved,
}: {
  state: { coupon?: CouponDto } | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const editing = !!state?.coupon?.id
  const form = useForm<TCouponSchema>({ resolver: zodResolver(getCouponSchema(t)), mode: "all", values: toForm(state?.coupon) })
  const { errors, isSubmitting } = form.formState
  const [type, generation] = useWatch({ control: form.control, name: ["type", "codeGeneration"] })

  async function onSubmit(v: TCouponSchema) {
    const body = {
      name: v.name,
      type: v.type,
      discountValue: Number(v.discountValue),
      codeGeneration: v.codeGeneration,
      code: v.codeGeneration === "MANUAL" ? v.code.toUpperCase() : undefined,
      minimumSpend: toNumberOrNull(v.minimumSpend),
      maximumSpend: toNumberOrNull(v.maximumSpend),
      useLimitTotal: toNumberOrNull(v.useLimitTotal),
      useLimitPerCompany: toNumberOrNull(v.useLimitPerCompany),
      expiryDate: v.expiryDate || null,
      enabled: v.enabled,
      description: v.description || null,
    }
    try {
      if (editing) await CouponService.update(state!.coupon!.id!, body)
      else await CouponService.create(body)
      toast.success(t("common.saved"))
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const field = (name: keyof TCouponSchema, label: string, props: React.ComponentProps<typeof Input> = {}, hint?: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`coupon-${name}`}>{label}</Label>
      <Input id={`coupon-${name}`} {...props} {...form.register(name)} />
      {hint && !errors[name] && <p className="text-muted-foreground text-xs">{hint}</p>}
      <FieldError message={errors[name]?.message as string | undefined} />
    </div>
  )

  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? t("coupons.edit") : t("coupons.create")}</DialogTitle>
          <DialogDescription>{t("coupons.formDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("name", t("coupons.name"))}
            <div className="grid gap-1.5">
              <Label htmlFor="coupon-type">{t("coupons.type")}</Label>
              <Controller
                control={form.control}
                name="type"
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger id="coupon-type" className="w-full" aria-label={t("coupons.type")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">{t("coupons.percentage")}</SelectItem>
                      <SelectItem value="FLAT">{t("coupons.flat")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {field("discountValue", type === "PERCENTAGE" ? t("coupons.discountPercent") : t("coupons.discountAmount"), { inputMode: "decimal" })}
            <div className="grid gap-1.5">
              <Label>{t("coupons.codeGeneration")}</Label>
              <Controller
                control={form.control}
                name="codeGeneration"
                render={({ field: f }) => (
                  <div role="radiogroup" aria-label={t("coupons.codeGeneration")} className="flex gap-2">
                    {(["MANUAL", "AUTO"] as const).map((g) => (
                      <Button
                        key={g}
                        type="button"
                        role="radio"
                        aria-checked={f.value === g}
                        variant={f.value === g ? "default" : "outline"}
                        size="sm"
                        onClick={() => f.onChange(g)}
                      >
                        {g === "MANUAL" ? t("coupons.manual") : t("coupons.auto")}
                      </Button>
                    ))}
                  </div>
                )}
              />
            </div>
            {generation === "MANUAL"
              ? field("code", t("coupons.code"), { className: "uppercase" })
              : (
                <p className="text-muted-foreground self-end text-sm">
                  {editing ? t("coupons.autoKeeps") : t("coupons.autoHint")}
                </p>
              )}
            {field("expiryDate", t("coupons.expiry"), { type: "date" }, t("coupons.noExpiryHint"))}
            {field("minimumSpend", t("coupons.minSpend"), { inputMode: "decimal" }, t("coupons.noLimitHint"))}
            {field("maximumSpend", t("coupons.maxSpend"), { inputMode: "decimal" }, t("coupons.noLimitHint"))}
            {field("useLimitTotal", t("coupons.usageLimit"), { inputMode: "numeric" }, t("coupons.noLimitHint"))}
            {field("useLimitPerCompany", t("coupons.limitPerCompany"), { inputMode: "numeric" }, t("coupons.noLimitHint"))}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="coupon-description">{t("plans.description")}</Label>
            <Textarea id="coupon-description" rows={2} {...form.register("description")} />
            <FieldError message={errors.description?.message} />
          </div>
          <Controller
            control={form.control}
            name="enabled"
            render={({ field: f }) => (
              <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                {t("plans.active")}
                <Switch checked={f.value} onCheckedChange={f.onChange} aria-label={t("plans.active")} />
              </label>
            )}
          />
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

/** View Details: the coupon and its usage history (GET /saas/admin/coupons/{id}). */
export function CouponDetailDialog({ couponId, onClose }: { couponId?: string; onClose: () => void }) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const [data, setData] = React.useState<{ id: string; coupon?: CouponDto; usage: CouponUsageDto[] }>()

  React.useEffect(() => {
    if (!couponId) return
    let cancelled = false
    CouponService.detail(couponId)
      .then((d) => !cancelled && setData({ id: couponId, coupon: d?.coupon, usage: d?.usageHistory ?? [] }))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [couponId])

  const current = data?.id === couponId ? data : undefined

  return (
    <Dialog open={!!couponId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("coupons.usageTitle", { code: current?.coupon?.code ?? "" })}</DialogTitle>
          <DialogDescription>{current?.coupon?.name ?? ""}</DialogDescription>
        </DialogHeader>
        {!current ? (
          <Skeleton className="h-32" />
        ) : current.usage.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("coupons.noUsage")}</p>
        ) : (
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("orders.company")}</TableHead>
                  <TableHead>{t("orders.number")}</TableHead>
                  <TableHead className="text-right">{t("coupons.discountApplied")}</TableHead>
                  <TableHead className="text-right">{t("subscription.total")}</TableHead>
                  <TableHead>{t("orders.status")}</TableHead>
                  <TableHead>{t("coupons.usedAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {current.usage.map((u) => (
                  <TableRow key={u.orderId ?? u.orderNumber}>
                    <TableCell>
                      <div className="font-medium">{u.companyName ?? "-"}</div>
                      <div className="text-muted-foreground text-xs">{u.companyEmail ?? ""}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{u.orderNumber ?? "-"}</TableCell>
                    <TableCell className="text-right">{money(u.discountApplied)}</TableCell>
                    <TableCell className="text-right">{money(u.finalPrice)}</TableCell>
                    <TableCell>
                      <OrderStatusBadge status={u.status} />
                    </TableCell>
                    <TableCell>{formatDate(u.usedAt, language, true)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
