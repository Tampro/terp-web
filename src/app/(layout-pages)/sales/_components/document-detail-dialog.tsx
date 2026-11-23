"use client"

import * as React from "react"
import { Printer } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useMoney } from "@/hooks/use-money"
import { formatNumber } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { printDocument } from "@/lib/print-document"
import type { LineDto } from "@/lib/sales/sales.service"
import { useBrandStore } from "@/store/brand.store"

import { SalesStatusBadge } from "./sales-status-badge"

export interface DetailView {
  title: string
  status?: Parameters<typeof SalesStatusBadge>[0]["status"]
  flags?: string[]
  fields: { label: string; value: string }[]
  lines?: LineDto[]
  /** returns: the per-line reason column */
  withReason?: boolean
  totals: { label: string; value: string; strong?: boolean }[]
  notes?: string | null
}

/**
 * Read-only view of a document or a return; `load` is called whenever `id` changes. "Print / PDF" opens a printable
 * copy of what is shown (the browser's "Save as PDF" gives the file): the backend has no staff PDF endpoint for sales
 * or purchase documents (only the client portal /portal/client/{kind}/{id}/pdf, checked 2026-11-23).
 */
export function SalesDetailDialog<D>({
  id,
  load,
  view,
  onClose,
  docLabel,
}: {
  /** kind of document for the printed heading and PDF file name, e.g. "Hóa đơn bán hàng" */
  docLabel?: string
  id?: string
  load: (id: string) => Promise<D>
  view: (d: D) => DetailView
  onClose: () => void
}) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const [state, setState] = React.useState<{ id?: string; data?: D; error?: string }>({})

  React.useEffect(() => {
    if (!id) return
    let cancelled = false
    load(id)
      .then((data) => !cancelled && setState({ id, data }))
      .catch((e: Error) => !cancelled && setState({ id, error: e.message }))
    return () => {
      cancelled = true
    }
  }, [id, load])

  const brand = useBrandStore((s) => s.brand)
  const ready = state.id === id
  const v = ready && state.data ? view(state.data) : undefined
  const lineText = (l: LineDto) => [l.itemName ?? "-", [l.sku, l.itemType ? t(`sales.itemType.${l.itemType}` as TranslationKey) : ""].filter(Boolean).join(" · ")].filter(Boolean).join("\n")

  function print() {
    if (!v) return
    const opened = printDocument(
      {
        title: [docLabel, v.title].filter(Boolean).join(" "),
        issuer: [brand?.titleText, brand?.companyAddress, brand?.companyMobile].filter(Boolean).join(" · ") || undefined,
        status: v.status ? t(`sales.status.${v.status}` as TranslationKey) : undefined,
        fields: v.fields,
        columns: [
          { label: t("sales.item") },
          { label: t("sales.quantity"), align: "right" },
          { label: t("sales.unitPrice"), align: "right" },
          { label: t("sales.discount"), align: "right" },
          { label: t("sales.tax"), align: "right" },
          { label: t("sales.lineTotal"), align: "right" },
          ...(v.withReason ? [{ label: t("sales.reason") }] : []),
        ],
        rows: (v.lines ?? []).map((l) => [
          lineText(l),
          formatNumber(l.quantity, language, 2),
          money(l.unitPrice),
          l.discountPct ? `${formatNumber(l.discountPct, language, 2)}%` : "-",
          l.taxRate ? `${formatNumber(l.taxRate, language, 2)}% · ${money(l.taxAmount)}` : t("sales.noTax"),
          money(l.lineTotal),
          ...(v.withReason ? [l.reason ?? "-"] : []),
        ]),
        totals: v.totals,
        notesLabel: t("sales.notes"),
        notes: v.notes,
        footer: brand?.footerText ?? undefined,
      },
      language,
    )
    if (!opened) toast.error(t("sales.printBlocked"))
  }

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {v?.title ?? t("sales.detail")}
            {v && <SalesStatusBadge status={v.status} />}
            {v?.flags?.map((f) => (
              <Badge key={f} variant="destructive">
                {f}
              </Badge>
            ))}
            {v && (
              <Button variant="outline" size="sm" className="ml-auto" onClick={print} data-testid="sales-print">
                <Printer className="size-4" /> {t("sales.print")}
              </Button>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">{t("sales.detail")}</DialogDescription>
        </DialogHeader>
        {!ready && <Skeleton className="h-48 w-full" />}
        {ready && state.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        {v && (
          <div className="grid gap-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              {v.fields.map((f) => (
                <div key={f.label}>
                  <dt className="text-muted-foreground text-xs">{f.label}</dt>
                  <dd className="font-medium">{f.value}</dd>
                </div>
              ))}
            </dl>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("sales.item")}</TableHead>
                    <TableHead className="text-right">{t("sales.quantity")}</TableHead>
                    <TableHead className="text-right">{t("sales.unitPrice")}</TableHead>
                    <TableHead className="text-right">{t("sales.discount")}</TableHead>
                    <TableHead className="text-right">{t("sales.tax")}</TableHead>
                    <TableHead className="text-right">{t("sales.lineTotal")}</TableHead>
                    {v.withReason && <TableHead>{t("sales.reason")}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(v.lines ?? []).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium">{l.itemName ?? "-"}</div>
                        <div className="text-muted-foreground text-xs">
                          {l.sku ?? ""} {l.itemType ? `· ${t(`sales.itemType.${l.itemType}` as TranslationKey)}` : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(l.quantity, language, 2)}</TableCell>
                      <TableCell className="text-right">{money(l.unitPrice)}</TableCell>
                      <TableCell className="text-right">
                        {l.discountPct ? `${formatNumber(l.discountPct, language, 2)}%` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {l.taxRate ? `${formatNumber(l.taxRate, language, 2)}% · ${money(l.taxAmount)}` : t("sales.noTax")}
                      </TableCell>
                      <TableCell className="text-right">{money(l.lineTotal)}</TableCell>
                      {v.withReason && <TableCell>{l.reason ?? "-"}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="text-sm">
                <p className="text-muted-foreground text-xs">{t("sales.notes")}</p>
                <p className="whitespace-pre-wrap">{v.notes || "-"}</p>
              </div>
              <dl className="grid content-start gap-1 text-sm">
                {v.totals.map((x) => (
                  <div key={x.label} className={x.strong ? "flex justify-between border-t pt-1 font-semibold" : "flex justify-between"}>
                    <dt>{x.label}</dt>
                    <dd>{x.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
