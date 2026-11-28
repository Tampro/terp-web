"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DayOffService, type DayOffDto, type StoreDto } from "@/lib/store/store.service"
import { useT } from "@/lib/i18n"

/** Upcoming day-offs of one store (from today in its zone, server side): add one date, delete. */
export function DayOffsDialog({ store, manage, onClose }: { store?: StoreDto; manage: boolean; onClose: () => void }) {
  const t = useT()
  const [rows, setRows] = React.useState<DayOffDto[]>([])
  const [reloadKey, setReloadKey] = React.useState(0)
  const [date, setDate] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!store?.id) return
    let cancelled = false
    DayOffService.list(store.id)
      .then((d) => !cancelled && setRows(d ?? []))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [store?.id, reloadKey])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!store?.id || !date) return
    setSaving(true)
    try {
      await DayOffService.create(store.id, { date, reason: reason.trim() || null })
      toast.success(t("common.saved"))
      setDate("")
      setReason("")
      setReloadKey((x) => x + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err)) // STO_011 exists, STO_012 past
    } finally {
      setSaving(false)
    }
  }

  async function remove(d: DayOffDto) {
    if (!store?.id || !d.id) return
    try {
      await DayOffService.remove(store.id, d.id)
      toast.success(t("sales.done.deleted"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err)) // STO_013
    }
    setReloadKey((x) => x + 1)
  }

  return (
    <Dialog open={!!store} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("store.dayOff.title", { name: store?.name ?? "" })}</DialogTitle>
          <DialogDescription className="sr-only">{t("store.dayOffs")}</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2">
          {rows.length === 0 && <li className="text-muted-foreground text-sm">{t("store.dayOff.empty")}</li>}
          {rows.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>
                <span className="font-mono">{d.date}</span>
                {d.reason && <span className="text-muted-foreground"> · {d.reason}</span>}
              </span>
              {manage && (
                <Button variant="ghost" size="icon" aria-label={t("store.dayOff.delete", { date: d.date ?? "" })} onClick={() => remove(d)}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {manage && (
          <form className="grid gap-3 border-t pt-4 sm:grid-cols-[10rem_1fr_auto] sm:items-end" onSubmit={add}>
            <div className="grid gap-1.5">
              <Label htmlFor="dayoff-date">{t("store.dayOff.date")}</Label>
              <Input id="dayoff-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dayoff-reason">{t("store.dayOff.reason")}</Label>
              <Input id="dayoff-reason" maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <Button type="submit" disabled={saving || !date}>
              {t("store.dayOff.add")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
