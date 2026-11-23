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
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useMoney } from "@/hooks/use-money"
import { useT, type TranslationKey } from "@/lib/i18n"
import { getDocumentSchema, toNumber, type TDocumentSchema } from "@/lib/sales/sales.schema"
import { salesDocuments, type DocumentDetail, type DocumentForm, type EDocumentKind } from "@/lib/sales/sales.service"

import type { SalesLookups } from "./use-sales-lookups"

const NONE = "__none"
const today = () => new Date().toLocaleDateString("en-CA") // yyyy-MM-dd, local
const plusDays = (d: number) => new Date(Date.now() + d * 86_400_000).toLocaleDateString("en-CA")
const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v))

function toForm(detail?: DocumentDetail): TDocumentSchema {
  const d = detail?.document
  return {
    customerId: d?.customerId ?? "",
    warehouseId: d?.warehouseId ?? "",
    invoiceType: d?.invoiceType ?? "PRODUCT",
    docDate: d?.docDate?.slice(0, 10) ?? today(),
    dueDate: d?.dueDate?.slice(0, 10) ?? plusDays(30),
    paymentTerms: detail?.paymentTerms ?? "",
    notes: detail?.notes ?? "",
    syncToGoogleCalendar: !!detail?.syncToGoogleCalendar,
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
 * §6 add / edit a draft quotation, proposal or invoice (PUT = full replacement of header and lines).
 * Line amounts here are a preview: the backend recomputes discount, tax (item's tax) and totals.
 */
export function DocumentFormDialog({
  kind,
  state,
  lookups,
  onClose,
  onSaved,
}: {
  kind: EDocumentKind
  /** null = closed; {} = new; {detail} = edit */
  state: { detail?: DocumentDetail } | null
  lookups: SalesLookups
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const money = useMoney()
  const service = React.useMemo(() => salesDocuments(kind), [kind])
  const editId = state?.detail?.document?.id
  // memoized: a new `values` object on every render resets the form (and the line array) again and again
  const values = React.useMemo(() => toForm(state?.detail), [state])
  const form = useForm<TDocumentSchema>({ resolver: zodResolver(getDocumentSchema(t)), mode: "all", values })
  const { errors, isSubmitting } = form.formState
  const lines = useFieldArray({ control: form.control, name: "lines" })
  const [invoiceType, watchedLines] = useWatch({ control: form.control, name: ["invoiceType", "lines"] })
  const service_ = kind === "INVOICE" && invoiceType === "SERVICE"
  const items = service_ ? lookups.items.filter((i) => i.type === "SERVICE") : lookups.items
  const itemById = (id: string) => lookups.items.find((i) => i.id === id)

  const totals = (watchedLines ?? []).reduce(
    (acc, l) => {
      const item = itemById(l.itemId)
      const qty = service_ ? 1 : toNumber(l.quantity) || 0
      const price = l.unitPrice.trim() === "" ? (item?.salePrice ?? 0) : toNumber(l.unitPrice) || 0
      const gross = qty * price
      const discount = (gross * (toNumber(l.discountPct) || 0)) / 100
      const tax = ((gross - discount) * (item?.taxRate ?? 0)) / 100
      return { subtotal: acc.subtotal + gross, discount: acc.discount + discount, tax: acc.tax + tax }
    },
    { subtotal: 0, discount: 0, tax: 0 }
  )

  async function onSubmit(v: TDocumentSchema) {
    const body: DocumentForm = {
      customerId: Number(v.customerId),
      warehouseId: service_ || !v.warehouseId ? null : Number(v.warehouseId),
      ...(kind === "INVOICE" ? { invoiceType: v.invoiceType, syncToGoogleCalendar: v.syncToGoogleCalendar } : {}),
      docDate: v.docDate,
      dueDate: v.dueDate,
      paymentTerms: v.paymentTerms.trim() || null,
      notes: v.notes.trim() || null,
      lines: v.lines.map((l) => ({
        itemId: Number(l.itemId),
        quantity: service_ ? 1 : toNumber(l.quantity),
        ...(l.unitPrice.trim() !== "" ? { unitPrice: toNumber(l.unitPrice) } : {}),
        ...(l.discountPct.trim() !== "" ? { discountPct: toNumber(l.discountPct) } : {}),
      })),
    }
    try {
      if (editId) await service.update(editId, body)
      else await service.create(body)
      toast.success(t("common.saved"))
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const k = kind.toLowerCase() as "quotation" | "proposal" | "invoice"
  const select = (
    name: "customerId" | "warehouseId",
    label: string,
    options: { value: string; label: string }[],
    optional = false
  ) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`doc-${name}`}>{label}</Label>
      <Controller
        control={form.control}
        name={name}
        render={({ field: f }) => (
          <Select value={f.value || (optional ? NONE : "")} onValueChange={(v) => f.onChange(v === NONE ? "" : v)}>
            <SelectTrigger id={`doc-${name}`} className="w-full" aria-label={label}>
              <SelectValue placeholder={t("sales.choose")} />
            </SelectTrigger>
            <SelectContent>
              {optional && <SelectItem value={NONE}>{t("sales.noWarehouse")}</SelectItem>}
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <FieldError message={errors[name]?.message} />
    </div>
  )

  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t(`sales.${k}.${editId ? "edit" : "create"}` as TranslationKey)}</DialogTitle>
          <DialogDescription>{t("sales.formDesc")}</DialogDescription>
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
              {kind === "INVOICE" && (
                <div className="grid gap-1.5">
                  <Label htmlFor="doc-invoiceType">{t("sales.invoiceType")}</Label>
                  <Controller
                    control={form.control}
                    name="invoiceType"
                    render={({ field: f }) => (
                      <Select value={f.value} onValueChange={f.onChange}>
                        <SelectTrigger id="doc-invoiceType" className="w-full" aria-label={t("sales.invoiceType")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PRODUCT">{t("sales.type.PRODUCT")}</SelectItem>
                          <SelectItem value="SERVICE">{t("sales.type.SERVICE")}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )}
              {select(
                "customerId",
                t("sales.customer"),
                lookups.customers.map((c) => ({ value: c.id ?? "", label: c.companyName ?? c.customerCode ?? "-" }))
              )}
              {!service_ &&
                select(
                  "warehouseId",
                  t("sales.warehouse"),
                  lookups.warehouses.map((w) => ({ value: w.id ?? "", label: w.name ?? "-" })),
                  true
                )}
              <div className="grid gap-1.5">
                <Label htmlFor="doc-docDate">{t(`sales.${k}.date` as TranslationKey)}</Label>
                <Input id="doc-docDate" type="date" {...form.register("docDate")} />
                <FieldError message={errors.docDate?.message} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="doc-dueDate">{t(kind === "INVOICE" ? "sales.dueDate" : "sales.validUntil")}</Label>
                <Input id="doc-dueDate" type="date" {...form.register("dueDate")} />
                <FieldError message={errors.dueDate?.message} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="doc-paymentTerms">{t("sales.paymentTerms")}</Label>
                <Input id="doc-paymentTerms" {...form.register("paymentTerms")} />
                <FieldError message={errors.paymentTerms?.message} />
              </div>
              {kind === "INVOICE" && (
                <div className="grid gap-1 sm:col-span-2">
                  <Controller
                    control={form.control}
                    name="syncToGoogleCalendar"
                    render={({ field }) => (
                      <label className="flex items-center gap-2 text-sm">
                        <Switch id="doc-syncToGoogleCalendar" checked={field.value} onCheckedChange={field.onChange} aria-label={t("sales.syncGoogle")} />
                        {t("sales.syncGoogle")}
                      </label>
                    )}
                  />
                  <p className="text-muted-foreground text-xs">{t("sales.syncGoogleHint")}</p>
                </div>
              )}
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
                      {!service_ && <TableHead className="w-24">{t("sales.quantity")}</TableHead>}
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
                      const qty = service_ ? 1 : toNumber(l?.quantity ?? "") || 0
                      const price = !l || l.unitPrice.trim() === "" ? (item?.salePrice ?? 0) : toNumber(l.unitPrice) || 0
                      const net = qty * price * (1 - (toNumber(l?.discountPct ?? "") || 0) / 100)
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
                                    {items.map((it) => (
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
                          {!service_ && (
                            <TableCell>
                              <Input
                                inputMode="decimal"
                                aria-label={t("sales.quantityOfLine", { n: i + 1 })}
                                {...form.register(`lines.${i}.quantity`)}
                              />
                              <FieldError message={e?.quantity?.message} />
                            </TableCell>
                          )}
                          <TableCell>
                            <Input
                              inputMode="decimal"
                              placeholder={item?.salePrice != null ? String(item.salePrice) : ""}
                              aria-label={t("sales.priceOfLine", { n: i + 1 })}
                              {...form.register(`lines.${i}.unitPrice`)}
                            />
                            <FieldError message={e?.unitPrice?.message} />
                          </TableCell>
                          <TableCell>
                            <Input
                              inputMode="decimal"
                              aria-label={t("sales.discountOfLine", { n: i + 1 })}
                              {...form.register(`lines.${i}.discountPct`)}
                            />
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
                <Label htmlFor="doc-notes">{t("sales.notes")}</Label>
                <Textarea id="doc-notes" rows={4} {...form.register("notes")} />
                <FieldError message={errors.notes?.message} />
              </div>
              <dl className="grid content-start gap-1 text-sm" data-testid="doc-summary">
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
