"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { FieldError } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useMoney } from "@/hooks/use-money"
import { formatNumber } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"
import { getReturnSchema, toNumber, type TReturnSchema } from "@/lib/sales/sales.schema"
import {
  SalesReturnService,
  salesDocuments,
  type DocumentRow,
  type ReturnableLine,
  type ReturnDetail,
  type ReturnForm,
} from "@/lib/sales/sales.service"

import type { SalesLookups } from "./use-sales-lookups"

const SAME = "__invoice"
const today = () => new Date().toLocaleDateString("en-CA")

/**
 * §6.3 add / edit a draft sales return: pick a posted invoice, then the quantity per line (at most what is still
 * returnable, SAL_011). An empty or 0 quantity leaves the line out. PUT = full replacement.
 */
export function ReturnFormDialog({
  state,
  lookups,
  onClose,
  onSaved,
}: {
  state: { detail?: ReturnDetail } | null
  lookups: SalesLookups
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const open = state !== null
  const editId = state?.detail?.ret?.id
  const [invoices, setInvoices] = React.useState<DocumentRow[]>()
  const [returnable, setReturnable] = React.useState<{ invoiceId: string; lines: ReturnableLine[] }>()

  const initial = React.useMemo<TReturnSchema>(
    () => ({
      invoiceId: state?.detail?.ret?.invoiceId ?? "",
      warehouseId: state?.detail?.ret?.warehouseId ?? "",
      returnDate: state?.detail?.ret?.returnDate?.slice(0, 10) ?? today(),
      reason: state?.detail?.reason ?? "",
      notes: state?.detail?.notes ?? "",
      lines: [],
    }),
    [state]
  )
  const form = useForm<TReturnSchema>({ resolver: zodResolver(getReturnSchema(t)), mode: "all", values: initial })
  const { errors, isSubmitting } = form.formState
  const lines = useFieldArray({ control: form.control, name: "lines" })
  const [invoiceId, watched] = useWatch({ control: form.control, name: ["invoiceId", "lines"] })
  const invoice = invoices?.find((i) => i.id === invoiceId)

  // posted invoices only (SAL_010): the list has no multi-status filter, so drafts are dropped here
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    salesDocuments("INVOICE")
      .list({ size: 100 })
      .then((p) => !cancelled && setInvoices((p.content ?? []).filter((i) => i.status && i.status !== "DRAFT")))
      .catch((e: Error) => {
        if (cancelled) return
        setInvoices([])
        toast.error(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  React.useEffect(() => {
    if (!open || !invoiceId) return
    let cancelled = false
    SalesReturnService.returnable(invoiceId)
      .then((ls) => !cancelled && setReturnable({ invoiceId, lines: ls ?? [] }))
      .catch((e: Error) => {
        if (cancelled) return
        setReturnable({ invoiceId, lines: [] })
        toast.error(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [open, invoiceId])

  // one form row per returnable line; an edited return keeps its own quantities
  const { replace } = lines
  React.useEffect(() => {
    if (!returnable) return
    const own = state?.detail?.ret?.invoiceId === returnable.invoiceId ? (state?.detail?.lines ?? []) : []
    replace(
      returnable.lines.map((l) => {
        const mine = own.find((o) => o.invoiceLineId === l.invoiceLineId)
        return {
          invoiceLineId: l.invoiceLineId ?? "",
          // Spec (SalesReturnService): GET /returnable subtracts every non-deleted return, this draft included, while
          // saving excludes this return — so when editing the limit is returnable + this draft's own quantity
          returnable: (l.returnable ?? 0) + (mine?.quantity ?? 0),
          quantity: mine?.quantity != null ? String(mine.quantity) : "",
          reason: mine?.reason ?? "",
        }
      })
    )
  }, [returnable, replace, state])

  async function onSubmit(v: TReturnSchema) {
    const body: ReturnForm = {
      invoiceId: Number(v.invoiceId),
      warehouseId: v.warehouseId ? Number(v.warehouseId) : null,
      returnDate: v.returnDate,
      reason: v.reason.trim() || null,
      notes: v.notes.trim() || null,
      lines: v.lines
        .filter((l) => toNumber(l.quantity) > 0)
        .map((l) => ({ invoiceLineId: Number(l.invoiceLineId), quantity: toNumber(l.quantity), reason: l.reason.trim() || null })),
    }
    try {
      if (editId) await SalesReturnService.update(editId, body)
      else await SalesReturnService.create(body)
      toast.success(t("common.saved"))
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const lineInfo = (id: string) => returnable?.lines.find((l) => l.invoiceLineId === id)
  const total = (watched ?? []).reduce((s, l) => {
    const info = lineInfo(l.invoiceLineId)
    const net = (toNumber(l.quantity) || 0) * (info?.unitPrice ?? 0) * (1 - (info?.discountPct ?? 0) / 100)
    return s + net * (1 + (info?.taxRate ?? 0) / 100)
  }, 0)
  const service = invoice?.invoiceType === "SERVICE"

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t(editId ? "sales.return.edit" : "sales.return.create")}</DialogTitle>
          <DialogDescription>{t("sales.return.formDesc")}</DialogDescription>
        </DialogHeader>
        {!invoices ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ret-invoiceId">{t("sales.return.invoice")}</Label>
                <Controller
                  control={form.control}
                  name="invoiceId"
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange} disabled={!!editId}>
                      <SelectTrigger id="ret-invoiceId" className="w-full" aria-label={t("sales.return.invoice")}>
                        <SelectValue placeholder={t("sales.choose")} />
                      </SelectTrigger>
                      <SelectContent>
                        {invoices.map((i) => (
                          <SelectItem key={i.id} value={i.id ?? ""}>
                            {i.number ?? "-"} · {i.customerName ?? "-"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {invoices.length === 0 && <p className="text-muted-foreground text-xs">{t("sales.return.noInvoices")}</p>}
                <FieldError message={errors.invoiceId?.message} />
              </div>
              {!service && (
                <div className="grid gap-1.5">
                  <Label htmlFor="ret-warehouseId">{t("sales.return.warehouse")}</Label>
                  <Controller
                    control={form.control}
                    name="warehouseId"
                    render={({ field: f }) => (
                      <Select value={f.value || SAME} onValueChange={(v) => f.onChange(v === SAME ? "" : v)}>
                        <SelectTrigger id="ret-warehouseId" className="w-full" aria-label={t("sales.return.warehouse")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SAME}>{t("sales.return.invoiceWarehouse")}</SelectItem>
                          {lookups.warehouses.map((w) => (
                            <SelectItem key={w.id} value={w.id ?? ""}>
                              {w.name ?? "-"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )}
              <div className="grid gap-1.5">
                <Label htmlFor="ret-returnDate">{t("sales.return.date")}</Label>
                <Input id="ret-returnDate" type="date" {...form.register("returnDate")} />
                <FieldError message={errors.returnDate?.message} />
              </div>
            </div>

            {invoiceId && (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("sales.item")}</TableHead>
                      <TableHead className="text-right">{t("sales.return.invoiced")}</TableHead>
                      <TableHead className="text-right">{t("sales.return.available")}</TableHead>
                      <TableHead className="w-28">{t("sales.return.qty")}</TableHead>
                      <TableHead>{t("sales.reason")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returnable?.invoiceId !== invoiceId && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    )}
                    {returnable?.invoiceId === invoiceId && lines.fields.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground h-16 text-center">
                          {t("sales.return.nothingLeft")}
                        </TableCell>
                      </TableRow>
                    )}
                    {returnable?.invoiceId === invoiceId &&
                      lines.fields.map((f, i) => {
                        const info = lineInfo(f.invoiceLineId)
                        return (
                          <TableRow key={f.id}>
                            <TableCell>
                              <div className="font-medium">{info?.itemName ?? "-"}</div>
                              <div className="text-muted-foreground text-xs">
                                {info?.sku ?? ""} · {money(info?.unitPrice)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{formatNumber(info?.invoiced, language, 2)}</TableCell>
                            <TableCell className="text-right">{formatNumber(f.returnable, language, 2)}</TableCell>
                            <TableCell>
                              <Input
                                inputMode="decimal"
                                aria-label={t("sales.return.qtyOf", { item: info?.itemName ?? "" })}
                                {...form.register(`lines.${i}.quantity`)}
                              />
                              <FieldError message={errors.lines?.[i]?.quantity?.message} />
                            </TableCell>
                            <TableCell>
                              <Input
                                aria-label={t("sales.return.reasonOf", { item: info?.itemName ?? "" })}
                                {...form.register(`lines.${i}.reason`)}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                  </TableBody>
                </Table>
              </div>
            )}
            <FieldError message={errors.lines?.root?.message ?? errors.lines?.message} />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="ret-reason">{t("sales.return.reason")}</Label>
                <Input id="ret-reason" {...form.register("reason")} />
                <FieldError message={errors.reason?.message} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ret-notes">{t("sales.notes")}</Label>
                <Textarea id="ret-notes" rows={2} {...form.register("notes")} />
                <FieldError message={errors.notes?.message} />
              </div>
            </div>
            <p className="text-right text-sm font-semibold" data-testid="ret-total">
              {t("sales.total")}: {money(total)}
            </p>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
