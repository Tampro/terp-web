"use client"

import * as React from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { FieldError } from "@/components/auth/password-input"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useUrlQuery } from "@/hooks/use-url-query"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatNumber } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { CatalogService } from "@/lib/inventory/inventory.service"
import { toNumber } from "@/lib/sales/sales.schema"

type Kind = "categories" | "taxes" | "units"
/** One row of any of the three lists. */
type Row = { id?: string; name?: string; color?: string | null; rate?: number }

// Limits from inventory-service CatalogService: category name ≤100 + color #RRGGBB, tax name ≤100 + rate 0..100
// (missing = 0), unit name ≤50; delete answers INV_006 while an item uses it.
const MAX: Record<Kind, number> = { categories: 100, taxes: 100, units: 50 }
const COLOR = /^#[0-9A-Fa-f]{6}$/

export default function InventorySetupPage() {
  return (
    <React.Suspense>
      <InventorySetup />
    </React.Suspense>
  )
}

/** §9 Setup: Categories (name, color), Taxes (name, rate %, default 0), Units. */
function InventorySetup() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("INVENTORY_MANAGE")
  const { searchParams, update } = useUrlQuery()
  const kindParam = searchParams.get("tab")
  const kind: Kind = kindParam === "taxes" || kindParam === "units" ? kindParam : "categories"
  const [rows, setRows] = React.useState<{ kind: Kind; list: Row[] }>()
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [editing, setEditing] = React.useState<{ row?: Row } | null>(null)
  const [deleting, setDeleting] = React.useState<Row>()

  React.useEffect(() => {
    let cancelled = false
    ;(CatalogService[kind].list() as Promise<Row[]>)
      .then((list) => !cancelled && setRows({ kind, list }))
      .catch((e: Error) => {
        if (cancelled) return
        setRows({ kind, list: [] })
        toast.error(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [kind, reloadKey])

  const list = rows?.kind === kind ? rows.list : undefined
  const singular = { categories: "category", taxes: "tax", units: "unit" }[kind] as "category" | "tax" | "unit"
  const cols = kind === "units" ? 2 : 3

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.inventory.setup")} description={t("inventory.setup.subtitle")}>
        {manage && (
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> {t(`inventory.${singular}.create` as TranslationKey)}
          </Button>
        )}
      </PageHeader>
      <Tabs value={kind} onValueChange={(v) => update({ tab: v === "categories" ? "" : v })}>
        <TabsList>
          <TabsTrigger value="categories">{t("inventory.setup.categories")}</TabsTrigger>
          <TabsTrigger value="taxes">{t("inventory.setup.taxes")}</TabsTrigger>
          <TabsTrigger value="units">{t("inventory.setup.units")}</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("inventory.name")}</TableHead>
                {kind === "categories" && <TableHead>{t("inventory.setup.color")}</TableHead>}
                {kind === "taxes" && <TableHead className="text-right">{t("inventory.setup.rate")}</TableHead>}
                <TableHead className="w-24">
                  <span className="sr-only">{t("common.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!list && (
                <TableRow>
                  <TableCell colSpan={cols}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              )}
              {list?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={cols} className="text-muted-foreground h-20 text-center">
                    {t("inventory.setup.empty")}
                  </TableCell>
                </TableRow>
              )}
              {list?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  {kind === "categories" && (
                    <TableCell>
                      {r.color ? (
                        <span className="inline-flex items-center gap-2 font-mono text-xs">
                          <span className="size-3 rounded-full border" style={{ backgroundColor: r.color }} />
                          {r.color}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  )}
                  {kind === "taxes" && <TableCell className="text-right">{formatNumber(r.rate ?? 0, language, 2)}%</TableCell>}
                  <TableCell>
                    {manage && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={t("inventory.editNamed", { name: r.name ?? "" })} onClick={() => setEditing({ row: r })}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={t("inventory.deleteNamed", { name: r.name ?? "" })} onClick={() => setDeleting(r)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          {editing && (
            <CatalogForm
              key={`${kind}-${editing.row?.id ?? "new"}`}
              kind={kind}
              row={editing.row}
              title={t(`inventory.${singular}.${editing.row ? "edit" : "create"}` as TranslationKey)}
              onClose={() => setEditing(null)}
              onSaved={reload}
            />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("inventory.confirm.deleteNamed", { name: deleting?.name ?? "" })}
        description={t("inventory.confirm.deleteCatalogDesc")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (!deleting?.id) return
          try {
            await CatalogService[kind].remove(deleting.id)
            toast.success(t("sales.done.deleted"))
            reload()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e)) // INV_006: still used by an item
          }
        }}
      />
    </div>
  )
}

function CatalogForm({
  kind,
  row,
  title,
  onClose,
  onSaved,
}: {
  kind: Kind
  row?: Row
  title: string
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const [name, setName] = React.useState(row?.name ?? "")
  const [color, setColor] = React.useState(row?.color ?? "#1E88E5")
  const [rate, setRate] = React.useState(row?.rate === undefined ? "0" : String(row.rate))
  const [errors, setErrors] = React.useState<{ name?: string; rate?: string }>({})
  const [busy, setBusy] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const n = name.trim()
    const r = rate.trim() === "" ? 0 : toNumber(rate)
    const errs = {
      name: !n ? t("purchase.v.required") : n.length > MAX[kind] ? t("sales.v.max", { n: MAX[kind] }) : undefined,
      rate: kind === "taxes" && !(r >= 0 && r <= 100) ? t("inventory.v.rate") : undefined,
    }
    setErrors(errs)
    if (errs.name || errs.rate) return
    setBusy(true)
    try {
      if (kind === "categories") await CatalogService.categories.save(row?.id, { name: n, color: COLOR.test(color) ? color : null })
      else if (kind === "taxes") await CatalogService.taxes.save(row?.id, { name: n, rate: r })
      else await CatalogService.units.save(row?.id, { name: n })
      toast.success(t("common.saved"))
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">{title}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="cat-name">{t("inventory.name")}</Label>
        <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} />
        <FieldError message={errors.name} />
      </div>
      {kind === "categories" && (
        <div className="grid gap-1.5">
          <Label htmlFor="cat-color">{t("inventory.setup.color")}</Label>
          <Input id="cat-color" type="color" className="h-9 w-20 p-1" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
      )}
      {kind === "taxes" && (
        <div className="grid gap-1.5">
          <Label htmlFor="cat-rate">{t("inventory.setup.rate")}</Label>
          <Input id="cat-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          <FieldError message={errors.rate} />
        </div>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={busy}>
          {t("common.save")}
        </Button>
      </DialogFooter>
    </form>
  )
}
