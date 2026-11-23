"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { FieldError } from "@/components/auth/password-input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useMoney } from "@/hooks/use-money"
import { useT } from "@/lib/i18n"
import { getPurchaseInvoiceSchema, type TPurchaseInvoiceSchema } from "@/lib/purchase/purchase.schema"
import { PurchaseInvoiceService, type PurchaseInvoiceDetail, type PurchaseInvoiceForm } from "@/lib/purchase/purchase.service"
import { toNumber } from "@/lib/sales/sales.schema"

import type { PurchaseLookups } from "./use-purchase-lookups"

const NONE = "__none"
const today = () => new Date().toLocaleDateString("en-CA")
const plusDays = (d: number) => new Date(Date.now() + d * 86_400_000).toLocaleDateString("en-CA")
const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v))

function toForm(detail?: PurchaseInvoiceDetail): TPurchaseInvoiceSchema {
  const d = detail?.invoice
  return {
    vendorId: d?.vendorId ?? "",
    warehouseId: d?.warehouseId ?? "",
    invoiceDate: d?.invoiceDate?.slice(0, 10) ?? today(),
    dueDate: d?.dueDate?.slice(0, 10) ?? plusDays(30),
    paymentTerms: detail?.paymentTerms ?? "",
    notes: detail?.notes ?? "",
    lines: detail?.lines?.length
      ? detail.lines.map((l) => ({
          itemId: l.itemId ?? "",
          quantity: str(l.quantity),
          unitPrice: str(l.unitPrice),
          discountPct: str(l.discountPct),
        }))
      : [{ itemId: "", quantity: "1", unitPrice: "", discountPct: "" }],
  }
}

/**
 * §8.1 add / edit a draft purchase invoice: vendor, receiving warehouse, lines (PUT = full replacement). An empty
 * price takes the item's purchase price; the backend recomputes discount, tax and totals.
 */
export function PurchaseInvoiceFormDialog({
  state,
  lookups,
  onClose,
  onSaved,
}: {
  /** null = closed; {} = new; {detail} = edit */
  state: { detail?: PurchaseInvoiceDetail } | null
  lookups: PurchaseLookups
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const money = useMoney()
  const editId = state?.detail?.invoice?.id
  // memoized: a new `values` object on every render resets the form (and the line array) again and again
  const values = React.useMemo(() => toForm(state?.detail), [state])
  const form = useForm<TPurchaseInvoiceSchema>({ resolver: zodResolver(getPurchaseInvoiceSchema(t)), mode: "all", values })
  const { errors, isSubmitting } = form.formState
  const lines = useFieldArray({ control: form.control, name: "lines" })
  const watchedLines = useWatch({ control: form.control, name: "lines" })
  const itemById = (id: string) => lookups.items.find((i) => i.id === id)
  const priceOf = (l: TPurchaseInvoiceSchema["lines"][number]) =>
    l.unitPrice.trim() === "" ? (itemById(l.itemId)?.purchasePrice ?? 0) : toNumber(l.unitPrice) || 0

  const totals = (watchedLines ?? []).reduce(
    (acc, l) => {
      const gross = (toNumber(l.quantity) || 0) * priceOf(l)
      const discount = (gross * (toNumber(l.discountPct) || 0)) / 100
      const tax = ((gross - discount) * (itemById(l.itemId)?.taxRate ?? 0)) / 100
      return { subtotal: acc.subtotal + gross, discount: acc.discount + discount, tax: acc.tax + tax }
    },
    { subtotal: 0, discount: 0, tax: 0 }
  )

  async function onSubmit(v: TPurchaseInvoiceSchema) {
    const body: PurchaseInvoiceForm = {
      vendorId: Number(v.vendorId),
      warehouseId: v.warehouseId ? Number(v.warehouseId) : null,
      invoiceDate: v.invoiceDate,
      dueDate: v.dueDate,
      paymentTerms: v.paymentTerms.trim() || null,
      notes: v.notes.trim() || null,
      lines: v.lines.map((l) => ({
        itemId: Number(l.itemId),
        quantity: toNumber(l.quantity),
        ...(l.unitPrice.trim() !== "" ? { unitPrice: toNumber(l.unitPrice) } : {}),
        ...(l.discountPct.trim() !== "" ? { discountPct: toNumber(l.discountPct) } : {}),
      })),
    }
    try {
      if (editId) await PurchaseInvoiceService.update(editId, body)
      else await PurchaseInvoiceService.create(body)
      toast.success(t("common.saved"))
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t(editId ? "purchase.invoice.edit" : "purchase.invoice.create")}</DialogTitle>
          <DialogDescription>{t("purchase.invoice.formDesc")}</DialogDescription>
        </DialogHeader>
        {lookups.loading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
            {lookups.error && (
              <Alert variant="destructive">
                <AlertDescription>{lookups.error}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="pi-vendorId">{t("purchase.vendor")}</Label>
                <Controller
                  control={form.control}
                  name="vendorId"
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger id="pi-vendorId" className="w-full" aria-label={t("purchase.vendor")}>
                        <SelectValue placeholder={t("sales.choose")} />
                      </SelectTrigger>
                      <SelectContent>
                        {lookups.vendors.map((v) => (
                          <SelectItem key={v.id} value={v.id ?? ""}>
                            {v.companyName ?? v.vendorCode ?? "-"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {lookups.vendors.length === 0 && <p className="text-muted-foreground text-xs">{t("purchase.noVendors")}</p>}
                <FieldError message={errors.vendorId?.message} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pi-warehouseId">{t("purchase.receivingWarehouse")}</Label>
                <Controller
                  control={form.control}
                  name="warehouseId"
                  render={({ field: f }) => (
                    <Select value={f.value || NONE} onValueChange={(v) => f.onChange(v === NONE ? "" : v)}>
                      <SelectTrigger id="pi-warehouseId" className="w-full" aria-label={t("purchase.receivingWarehouse")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t("sales.noWarehouse")}</SelectItem>
                        {lookups.warehouses.map((w) => (
                          <SelectItem key={w.id} value={w.id ?? ""}>
                            {w.name ?? "-"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-muted-foreground text-xs">{t("purchase.warehouseHint")}</p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pi-paymentTerms">{t("sales.paymentTerms")}</Label>
                <Input id="pi-paymentTerms" {...form.register("paymentTerms")} />
                <FieldError message={errors.paymentTerms?.message} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pi-invoiceDate">{t("sales.invoice.date")}</Label>
                <Input id="pi-invoiceDate" type="date" {...form.register("invoiceDate")} />
                <FieldError message={errors.invoiceDate?.message} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pi-dueDate">{t("sales.dueDate")}</Label>
                <Input id="pi-dueDate" type="date" {...form.register("dueDate")} />
                <FieldError message={errors.dueDate?.message} />
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>{t("sales.items")}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={lines.fields.length >= 200}
                  onClick={() => lines.append({ itemId: "", quantity: "1", unitPrice: "", discountPct: "" })}
                >
                  <Plus className="size-4" /> {t("sales.addLine")}
                </Button>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-56">{t("sales.item")}</TableHead>
                      <TableHead className="w-24">{t("sales.quantity")}</TableHead>
                      <TableHead className="w-32">{t("sales.unitPrice")}</TableHead>
                      <TableHead className="w-24">{t("sales.discountPct")}</TableHead>
                      <TableHead>{t("sales.tax")}</TableHead>
                      <TableHead className="text-right">{t("sales.lineTotal")}</TableHead>
                      <TableHead className="w-10">
                        <span className="sr-only">{t("common.actions")}</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.fields.map((f, i) => {
                      const l = watchedLines?.[i]
                      const item = l ? itemById(l.itemId) : undefined
                      const net = l ? (toNumber(l.quantity) || 0) * priceOf(l) * (1 - (toNumber(l.discountPct) || 0) / 100) : 0
                      const e = errors.lines?.[i]
                      return (
                        <TableRow key={f.id}>
                          <TableCell>
                            <Controller
                              control={form.control}
                              name={`lines.${i}.itemId`}
                              render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <SelectTrigger className="w-full" aria-label={t("sales.itemOfLine", { n: i + 1 })}>
                                    <SelectValue placeholder={t("sales.choose")} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {lookups.items.map((it) => (
                                      <SelectItem key={it.id} value={it.id ?? ""}>
                                        {it.name ?? "-"}
                                        {it.sku ? ` (${it.sku})` : ""}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                            <FieldError message={e?.itemId?.message} />
                          </TableCell>
                          <TableCell>
                            <Input inputMode="decimal" aria-label={t("sales.quantityOfLine", { n: i + 1 })} {...form.register(`lines.${i}.quantity`)} />
                            <FieldError message={e?.quantity?.message} />
                          </TableCell>
                          <TableCell>
                            <Input
                              inputMode="decimal"
                              placeholder={item?.purchasePrice != null ? String(item.purchasePrice) : ""}
                              aria-label={t("sales.priceOfLine", { n: i + 1 })}
                              {...form.register(`lines.${i}.unitPrice`)}
                            />
                            <FieldError message={e?.unitPrice?.message} />
                          </TableCell>
                          <TableCell>
                            <Input inputMode="decimal" aria-label={t("sales.discountOfLine", { n: i + 1 })} {...form.register(`lines.${i}.discountPct`)} />
                            <FieldError message={e?.discountPct?.message} />
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {item ? (item.taxRate ? `${item.taxName ?? ""} ${item.taxRate}%`.trim() : t("sales.noTax")) : "-"}
                          </TableCell>
                          <TableCell className="text-right">{money(net)}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={lines.fields.length === 1}
                              aria-label={t("sales.removeLine", { n: i + 1 })}
                              onClick={() => lines.remove(i)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <FieldError message={errors.lines?.root?.message ?? errors.lines?.message} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="pi-notes">{t("sales.notes")}</Label>
                <Textarea id="pi-notes" rows={4} {...form.register("notes")} />
                <FieldError message={errors.notes?.message} />
              </div>
              <dl className="grid content-start gap-1 text-sm" data-testid="pi-summary">
                <div className="flex justify-between">
                  <dt>{t("sales.subtotal")}</dt>
                  <dd>{money(totals.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t("sales.discount")}</dt>
                  <dd>{totals.discount ? `-${money(totals.discount)}` : money(0)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t("sales.tax")}</dt>
                  <dd>{money(totals.tax)}</dd>
                </div>
                <div className="flex justify-between border-t pt-1 font-semibold">
                  <dt>{t("sales.total")}</dt>
                  <dd>{money(totals.subtotal - totals.discount + totals.tax)}</dd>
                </div>
                <p className="text-muted-foreground text-xs">{t("sales.previewHint")}</p>
              </dl>
            </div>

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
