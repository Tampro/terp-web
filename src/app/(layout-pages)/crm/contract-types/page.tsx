"use client"

import * as React from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuthStore } from "@/lib/auth/auth.store"
import { ContractTypeService, type ContractSettingDto, type ContractTypeDto } from "@/lib/crm/crm.service"
import { useT } from "@/lib/i18n"

import { attempt, FormField } from "../_components/crm-kit"

/** §7.5 Contract types (name, status) and the contract number prefix (e.g. CON → CON0001). */
export default function ContractTypesPage() {
  const t = useT()
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("CRM_CONTRACT_MANAGE")
  const [types, setTypes] = React.useState<ContractTypeDto[]>()
  const [setting, setSetting] = React.useState<ContractSettingDto>()
  const [prefix, setPrefix] = React.useState<string>()
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [editing, setEditing] = React.useState<{ type?: ContractTypeDto } | null>(null)
  const [deleting, setDeleting] = React.useState<ContractTypeDto>()

  React.useEffect(() => {
    let cancelled = false
    Promise.all([ContractTypeService.list(), ContractTypeService.settings()])
      .then(([ty, s]) => !cancelled && (setTypes(ty), setSetting(s)))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const prefixValue = prefix ?? setting?.prefix ?? ""

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.crm.contractTypes")} description={t("crm.contractType.subtitle")}>
        {manage && (
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> {t("crm.contractType.create")}
          </Button>
        )}
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("crm.name")}</TableHead>
                  <TableHead className="text-right">{t("crm.contractType.count")}</TableHead>
                  <TableHead>{t("crm.status")}</TableHead>
                  <TableHead className="w-24">
                    <span className="sr-only">{t("common.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!types && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                )}
                {types?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground h-20 text-center">
                      {t("crm.contractType.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {types?.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell>{x.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{x.contractCount ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={x.active ? "default" : "outline"}>{t(x.active ? "crm.active" : "crm.inactive")}</Badge>
                    </TableCell>
                    <TableCell>
                      {manage && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label={t("crm.editNamed", { name: x.name ?? "" })} onClick={() => setEditing({ type: x })}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label={t("crm.deleteNamed", { name: x.name ?? "" })} onClick={() => setDeleting(x)}>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("crm.contractSetting.title")}</CardTitle>
            <CardDescription>
              {setting?.nextContractNumber ? t("crm.contract.nextNumber", { number: setting.nextContractNumber }) : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex items-end gap-2"
              onSubmit={async (e) => {
                e.preventDefault()
                const p = prefixValue.trim()
                if (!p) return toast.error(t("crm.v.required"))
                if (await attempt(() => ContractTypeService.saveSettings(p), t("common.saved"))) {
                  setPrefix(undefined)
                  reload()
                }
              }}
            >
              <FormField id="ct-prefix" label={t("crm.contractSetting.prefix")} className="flex-1">
                <Input id="ct-prefix" value={prefixValue} disabled={!manage} onChange={(e) => setPrefix(e.target.value)} />
              </FormField>
              {manage && <Button type="submit">{t("common.save")}</Button>}
            </form>
          </CardContent>
        </Card>
      </div>

      <TypeDialog
        state={editing}
        onClose={() => setEditing(null)}
        onSave={async (body, id) => {
          const ok = await attempt(() => ContractTypeService.save(id, body), t("common.saved"))
          if (ok) reload()
          return ok
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("crm.confirm.deleteContractType", { name: deleting?.name ?? "" })}
        description={t("crm.confirm.deleteDesc")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (deleting && (await attempt(() => ContractTypeService.remove(deleting.id!), t("crm.done.deleted")))) reload()
        }}
      />
    </div>
  )
}

function TypeDialog({
  state,
  onClose,
  onSave,
}: {
  state: { type?: ContractTypeDto } | null
  onClose: () => void
  onSave: (body: { name: string; active: boolean }, id?: string) => Promise<boolean>
}) {
  const t = useT()
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">{state && <TypeForm key={state.type?.id ?? "new"} type={state.type} onClose={onClose} onSave={onSave} t={t} />}</DialogContent>
    </Dialog>
  )
}

function TypeForm({
  type,
  onClose,
  onSave,
  t,
}: {
  type?: ContractTypeDto
  onClose: () => void
  onSave: (body: { name: string; active: boolean }, id?: string) => Promise<boolean>
  t: ReturnType<typeof useT>
}) {
  const [name, setName] = React.useState(type?.name ?? "")
  const [active, setActive] = React.useState(type?.active ?? true)
  const [error, setError] = React.useState<string>()
  const [busy, setBusy] = React.useState(false)
  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const v = name.trim()
        if (!v) return setError(t("crm.v.required"))
        if (v.length > 150) return setError(t("crm.v.max", { n: 150 }))
        setBusy(true)
        const ok = await onSave({ name: v, active }, type?.id)
        setBusy(false)
        if (ok) onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>{t(type ? "crm.contractType.edit" : "crm.contractType.create")}</DialogTitle>
        <DialogDescription className="sr-only">{t("menu.crm.contractTypes")}</DialogDescription>
      </DialogHeader>
      <FormField id="type-name" label={t("crm.name")} error={error}>
        <Input id="type-name" value={name} onChange={(e) => (setName(e.target.value), setError(undefined))} />
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={active} onCheckedChange={setActive} /> {t("crm.active")}
      </label>
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
