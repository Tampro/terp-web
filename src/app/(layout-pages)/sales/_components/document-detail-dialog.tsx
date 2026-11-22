"use client"

import * as React from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useMoney } from "@/hooks/use-money"
import { formatNumber } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import type { LineDto } from "@/lib/sales/sales.service"

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

/** Read-only view of a document or a return; `load` is called whenever `id` changes. */
export function SalesDetailDialog<D>({
  id,
  load,
  view,
  onClose,
}: {
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

  const ready = state.id === id
  const v = ready && state.data ? view(state.data) : undefined

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {v?.title ?? t("sales.detail")}
            {v && <SalesStatusBadge status={v.status} />}
            {v?.flags?.map((f) => (
              <Badge key={f} variant="destructive">
                {f}
              </Badge>
            ))}
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
