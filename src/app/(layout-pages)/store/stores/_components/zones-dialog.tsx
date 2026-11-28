"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FieldError } from "@/components/auth/password-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getZoneSchema, type TZoneSchema } from "@/lib/store/store.schema"
import { ZoneService, type StoreDto, type ZoneDto } from "@/lib/store/store.service"
import { useT } from "@/lib/i18n"

const SAMPLE = '{"type":"Polygon","coordinates":[[[126.88,37.47],[126.90,37.47],[126.90,37.49],[126.88,37.49]]]}'

/** Zones of one store: list, add (GeoJSON pasted as text; the server validates the polygon, STO_009), delete. */
export function ZonesDialog({ store, manage, onClose }: { store?: StoreDto; manage: boolean; onClose: () => void }) {
  const t = useT()
  const [zones, setZones] = React.useState<ZoneDto[]>([])
  const [reloadKey, setReloadKey] = React.useState(0)
  const form = useForm<TZoneSchema>({ resolver: zodResolver(getZoneSchema(t)), mode: "all", values: { name: "", area: SAMPLE } })
  const { errors, isSubmitting } = form.formState

  React.useEffect(() => {
    if (!store?.id) return
    let cancelled = false
    ZoneService.list(store.id)
      .then((z) => !cancelled && setZones(z ?? []))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [store?.id, reloadKey])

  async function onSubmit(v: TZoneSchema) {
    if (!store?.id) return
    try {
      await ZoneService.create(store.id, { name: v.name.trim(), area: JSON.parse(v.area) })
      toast.success(t("common.saved"))
      form.reset({ name: "", area: SAMPLE })
      setReloadKey((x) => x + 1)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e)) // STO_009 invalid polygon, STO_001
    }
  }

  async function remove(z: ZoneDto) {
    if (!store?.id || !z.id) return
    try {
      await ZoneService.remove(store.id, z.id)
      toast.success(t("sales.done.deleted"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e)) // STO_008
    }
    setReloadKey((x) => x + 1)
  }

  return (
    <Dialog open={!!store} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("store.zone.title", { name: store?.name ?? "" })}</DialogTitle>
          <DialogDescription className="sr-only">{t("store.zones")}</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2">
          {zones.length === 0 && <li className="text-muted-foreground text-sm">{t("store.zone.empty")}</li>}
          {zones.map((z) => (
            <li key={z.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="font-medium">{z.name}</span>
                <span className="text-muted-foreground">
                  {t("store.zone.points", { count: Math.max(0, (z.area?.coordinates?.[0]?.length ?? 1) - 1) })}
                </span>
                {z.active === false && <Badge variant="outline">{t("store.inactive")}</Badge>}
              </span>
              {manage && (
                <Button variant="ghost" size="icon" aria-label={t("store.zone.delete", { name: z.name ?? "" })} onClick={() => remove(z)}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {manage && (
          <form className="grid gap-3 border-t pt-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <div className="grid gap-1.5">
              <Label htmlFor="zone-name">{t("store.zone.name")}</Label>
              <Input id="zone-name" {...form.register("name")} />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="zone-area">{t("store.zone.area")}</Label>
              <Textarea id="zone-area" rows={5} className="font-mono text-xs" {...form.register("area")} />
              <FieldError message={errors.area?.message} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {t("store.zone.add")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
