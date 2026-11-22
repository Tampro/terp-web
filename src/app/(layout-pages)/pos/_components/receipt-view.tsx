"use client"

import * as React from "react"
import { Download, Printer } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useMoney } from "@/hooks/use-money"
import { formatDate, formatNumber } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"
import { openBlob, PosService, saveBlob, type PosLineDto, type PosTaxDto } from "@/lib/pos/pos.service"

export interface ReceiptData {
  /** set once paid */
  id?: string
  number?: string
  receiptNumber?: string
  date?: string
  customerName?: string
  warehouseName?: string
  bankAccountName?: string
  lines?: PosLineDto[]
  subtotal?: number
  taxes?: PosTaxDto[]
  discount?: number
  total?: number
}

/** Itemised receipt (manual §10): header fields, lines, Subtotal, taxes, Discount, Total; PDF download / print once paid. */
export function ReceiptView({ data }: { data: ReceiptData }) {
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const [busy, setBusy] = React.useState(false)

  async function pdf(open: boolean) {
    if (!data.id) return
    setBusy(true)
    try {
      const blob = await PosService.receiptPdf(data.id)
      if (open) openBlob(blob)
      else saveBlob(blob, `${data.receiptNumber ?? data.number ?? "receipt"}.pdf`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const fields = [
    { label: t("pos.number"), value: data.number },
    { label: t("pos.receiptNumber"), value: data.receiptNumber },
    { label: t("pos.date"), value: data.date ? formatDate(data.date, language) : undefined },
    { label: t("sales.customer"), value: data.customerName },
    { label: t("sales.warehouse"), value: data.warehouseName },
    { label: t("pos.bankAccount"), value: data.bankAccountName },
  ].filter((f) => f.value)

  return (
    <div className="grid gap-4" data-testid="pos-receipt">
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        {fields.map((f) => (
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
              <TableHead className="text-right">{t("sales.tax")}</TableHead>
              <TableHead className="text-right">{t("pos.amount")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data.lines ?? []).map((l, i) => (
              <TableRow key={`${l.itemId}-${i}`}>
                <TableCell>
                  <div className="font-medium">{l.itemName}</div>
                  <div className="text-muted-foreground font-mono text-xs">{l.sku}</div>
                </TableCell>
                <TableCell className="text-right">{formatNumber(l.quantity, language, 2)}</TableCell>
                <TableCell className="text-right">{money(l.unitPrice)}</TableCell>
                <TableCell className="text-right">{l.taxRate ? `${formatNumber(l.taxRate, language, 2)}% · ${money(l.taxAmount)}` : "-"}</TableCell>
                <TableCell className="text-right">{money(l.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Totals subtotal={data.subtotal} taxes={data.taxes} discount={data.discount} total={data.total} />
      {data.id && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => pdf(true)}>
            <Printer className="size-4" /> {t("pos.print")}
          </Button>
          <Button disabled={busy} onClick={() => pdf(false)}>
            <Download className="size-4" /> {t("pos.downloadPdf")}
          </Button>
        </div>
      )}
    </div>
  )
}

/** Subtotal, one row per tax, Discount, Total. */
export function Totals({ subtotal, taxes, discount, total }: { subtotal?: number; taxes?: PosTaxDto[]; discount?: number; total?: number }) {
  const t = useT()
  const money = useMoney()
  return (
    <dl className="grid gap-1 text-sm" data-testid="pos-totals">
      <div className="flex justify-between">
        <dt>{t("sales.subtotal")}</dt>
        <dd>{money(subtotal)}</dd>
      </div>
      {(taxes ?? []).map((x) => (
        <div key={x.name} className="flex justify-between">
          <dt>
            {x.name} ({x.rate}%)
          </dt>
          <dd>{money(x.amount)}</dd>
        </div>
      ))}
      <div className="flex justify-between">
        <dt>{t("sales.discount")}</dt>
        <dd>-{money(discount)}</dd>
      </div>
      <div className="flex justify-between border-t pt-1 text-base font-semibold">
        <dt>{t("sales.total")}</dt>
        <dd>{money(total)}</dd>
      </div>
    </dl>
  )
}
