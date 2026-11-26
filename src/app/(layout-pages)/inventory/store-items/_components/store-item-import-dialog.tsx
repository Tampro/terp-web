"use client"

import * as React from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"

import { FieldError } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StoreItemService, type StoreItemBulkLine } from "@/lib/inventory/inventory.service"
import { parseStoreItemCsv, STORE_ITEM_CSV_MAX_BYTES, storeItemCsvTemplate } from "@/lib/inventory/store-item-csv"
import { useT, type TranslationKey } from "@/lib/i18n"

/** CSV → POST /store-items/bulk for the selected store; all or nothing on the server (INV_028 names the bad row). */
export function StoreItemImportDialog({
  open,
  warehouseId,
  storeName,
  onClose,
  onImported,
}: {
  open: boolean
  warehouseId: string
  storeName: string
  onClose: () => void
  onImported: () => void
}) {
  const t = useT()
  const [lines, setLines] = React.useState<StoreItemBulkLine[]>()
  const [error, setError] = React.useState<string>()
  const [busy, setBusy] = React.useState(false)
  const [fileKey, setFileKey] = React.useState(0)

  function reset() {
    setLines(undefined)
    setError(undefined)
    setFileKey((k) => k + 1)
  }

  async function pick(file: File | undefined) {
    setLines(undefined)
    setError(undefined)
    if (!file) return
    if (file.size > STORE_ITEM_CSV_MAX_BYTES) {
      setError(t("inventory.storeItem.csv.tooBig"))
      return
    }
    const r = parseStoreItemCsv(await file.text(), Number(warehouseId))
    if ("error" in r) setError(t(`inventory.storeItem.csv.${r.error}` as TranslationKey, { row: r.row ?? "" }))
    else setLines(r.lines)
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([storeItemCsvTemplate()], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "store-items-template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  async function send() {
    if (!lines?.length) return
    setBusy(true)
    try {
      const res = await StoreItemService.bulk(lines)
      toast.success(t("inventory.storeItem.imported", { created: res.created ?? 0, updated: res.updated ?? 0 }))
      onImported()
      reset()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)) // INV_028 (row n: reason), INV_029
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("inventory.storeItem.importTitle", { store: storeName })}</DialogTitle>
          <DialogDescription>{t("inventory.storeItem.importHint")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="si-file">{t("inventory.storeItem.file")}</Label>
          <Input key={fileKey} id="si-file" type="file" accept=".csv,text/csv" onChange={(e) => pick(e.target.files?.[0])} />
          {lines && <p className="text-sm">{t("inventory.storeItem.preview", { n: lines.length })}</p>}
          <FieldError message={error} />
        </div>
        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="ghost" onClick={downloadTemplate}>
            <Download className="size-4" /> {t("inventory.storeItem.template")}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="button" disabled={!lines?.length || busy} onClick={send}>
              {t("inventory.storeItem.importNow")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
