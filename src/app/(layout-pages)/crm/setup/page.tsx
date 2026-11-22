"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useUrlQuery } from "@/hooks/use-url-query"
import { useAuthStore } from "@/lib/auth/auth.store"
import { CrmSetupService, type EStageKind, type LabelDto, type PipelineDto, type StageDto } from "@/lib/crm/crm.service"
import { useT } from "@/lib/i18n"

import { attempt, FormField, NameDialog, PipelineSelect } from "../_components/crm-kit"
import { useCrmLookups } from "../_components/use-crm-lookups"

type Naming = { title: string; label: string; initial?: string; save: (name: string) => Promise<boolean> }
type Removing = { title: string; run: () => Promise<unknown> }

/** §7.1 CRM setup: pipelines with lead / deal stages (order), labels per pipeline, sources. */
export default function CrmSetupPage() {
  return (
    <React.Suspense>
      <CrmSetup />
    </React.Suspense>
  )
}

function CrmSetup() {
  const t = useT()
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("CRM_MANAGE")
  const lookups = useCrmLookups()
  const { searchParams, update } = useUrlQuery()
  const tab = searchParams.get("tab") ?? "pipelines"
  const [naming, setNaming] = React.useState<Naming>()
  const [removing, setRemoving] = React.useState<Removing>()
  const [label, setLabel] = React.useState<{ label?: LabelDto; pipelineId?: string }>()
  const labelPipeline = searchParams.get("pipelineId") ?? lookups.pipelines[0]?.id

  const save = (fn: () => Promise<unknown>) => async () => {
    const ok = await attempt(fn, t("common.saved"))
    if (ok) lookups.reload()
    return ok
  }
  const name = (title: string, label: string, run: (n: string) => Promise<unknown>, initial?: string) =>
    setNaming({ title, label, initial, save: (n) => save(() => run(n))() })

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.crm.setup")} description={t("crm.setup.subtitle")} />
      <Tabs value={tab} onValueChange={(v) => update({ tab: v })}>
        <TabsList>
          <TabsTrigger value="pipelines">{t("crm.pipelines")}</TabsTrigger>
          <TabsTrigger value="labels">{t("crm.labels")}</TabsTrigger>
          <TabsTrigger value="sources">{t("crm.sources")}</TabsTrigger>
        </TabsList>

        <TabsContent value="pipelines" className="flex flex-col gap-4">
          {manage && (
            <div>
              <Button onClick={() => name(t("crm.pipeline.create"), t("crm.name"), (n) => CrmSetupService.createPipeline(n))}>
                <Plus className="size-4" /> {t("crm.pipeline.create")}
              </Button>
            </div>
          )}
          {lookups.loading && <Skeleton className="h-40 w-full" />}
          {!lookups.loading && lookups.pipelines.length === 0 && (
            <Card>
              <CardContent className="text-muted-foreground py-10 text-center">{t("crm.pipeline.empty")}</CardContent>
            </Card>
          )}
          {lookups.pipelines.map((p) => (
            <PipelineCard
              key={p.id}
              pipeline={p}
              manage={manage}
              onRename={() =>
                name(t("crm.pipeline.rename"), t("crm.name"), (n) => CrmSetupService.renamePipeline(p.id!, n), p.name)
              }
              onRemove={() =>
                setRemoving({ title: t("crm.confirm.deletePipeline", { name: p.name ?? "" }), run: () => CrmSetupService.removePipeline(p.id!) })
              }
              onAddStage={(kind) =>
                name(t(kind === "LEAD" ? "crm.stage.addLead" : "crm.stage.addDeal"), t("crm.name"), (n) =>
                  CrmSetupService.addStage(p.id!, kind, n)
                )
              }
              onRenameStage={(s) => name(t("crm.stage.rename"), t("crm.name"), (n) => CrmSetupService.renameStage(s.id!, n), s.name)}
              onRemoveStage={(s) =>
                setRemoving({ title: t("crm.confirm.deleteStage", { name: s.name ?? "" }), run: () => CrmSetupService.removeStage(s.id!) })
              }
              onOrder={(kind, ids) => save(() => CrmSetupService.orderStages(p.id!, kind, ids))()}
            />
          ))}
        </TabsContent>

        <TabsContent value="labels">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <PipelineSelect pipelines={lookups.pipelines} value={labelPipeline} onChange={(v) => update({ pipelineId: v })} />
                {manage && labelPipeline && (
                  <Button onClick={() => setLabel({ pipelineId: labelPipeline })}>
                    <Plus className="size-4" /> {t("crm.label.create")}
                  </Button>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("crm.name")}</TableHead>
                    <TableHead>{t("crm.color")}</TableHead>
                    <TableHead className="w-24">
                      <span className="sr-only">{t("common.actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lookups.labels
                    .filter((l) => l.pipelineId === labelPipeline)
                    .map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <span className="rounded px-2 py-0.5 text-xs text-white" style={{ backgroundColor: l.color }}>
                            {l.name}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{l.color}</TableCell>
                        <TableCell className="text-right">
                          {manage && (
                            <RowButtons
                              name={l.name ?? ""}
                              onEdit={() => setLabel({ label: l, pipelineId: l.pipelineId })}
                              onRemove={() =>
                                setRemoving({
                                  title: t("crm.confirm.deleteLabel", { name: l.name ?? "" }),
                                  run: () => CrmSetupService.removeLabel(l.id!),
                                })
                              }
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  {lookups.labels.every((l) => l.pipelineId !== labelPipeline) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground h-20 text-center">
                        {t("crm.label.empty")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources">
          <Card>
            <CardContent className="flex flex-col gap-4">
              {manage && (
                <div>
                  <Button onClick={() => name(t("crm.source.create"), t("crm.name"), (n) => CrmSetupService.saveSource(undefined, n))}>
                    <Plus className="size-4" /> {t("crm.source.create")}
                  </Button>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("crm.name")}</TableHead>
                    <TableHead className="w-24">
                      <span className="sr-only">{t("common.actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lookups.sources.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="text-right">
                        {manage && (
                          <RowButtons
                            name={s.name ?? ""}
                            onEdit={() =>
                              name(t("crm.source.edit"), t("crm.name"), (n) => CrmSetupService.saveSource(s.id, n), s.name)
                            }
                            onRemove={() =>
                              setRemoving({
                                title: t("crm.confirm.deleteSource", { name: s.name ?? "" }),
                                run: () => CrmSetupService.removeSource(s.id!),
                              })
                            }
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {lookups.sources.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-muted-foreground h-20 text-center">
                        {t("crm.source.empty")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <NameDialog
        open={!!naming}
        title={naming?.title ?? ""}
        label={naming?.label ?? ""}
        initial={naming?.initial}
        onClose={() => setNaming(undefined)}
        onSave={(n) => naming?.save(n) ?? Promise.resolve(false)}
      />
      <LabelDialog
        state={label}
        pipelines={lookups.pipelines}
        onClose={() => setLabel(undefined)}
        onSave={(id, body) => save(() => CrmSetupService.saveLabel(id, body))()}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(undefined)}
        title={removing?.title ?? ""}
        description={t("crm.confirm.deleteDesc")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (removing) await save(removing.run)()
        }}
      />
    </div>
  )
}

function RowButtons({ name, onEdit, onRemove }: { name: string; onEdit: () => void; onRemove: () => void }) {
  const t = useT()
  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon" aria-label={t("crm.editNamed", { name })} onClick={onEdit}>
        <Pencil className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" aria-label={t("crm.deleteNamed", { name })} onClick={onRemove}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

function PipelineCard({
  pipeline,
  manage,
  onRename,
  onRemove,
  onAddStage,
  onRenameStage,
  onRemoveStage,
  onOrder,
}: {
  pipeline: PipelineDto
  manage: boolean
  onRename: () => void
  onRemove: () => void
  onAddStage: (kind: EStageKind) => void
  onRenameStage: (s: StageDto) => void
  onRemoveStage: (s: StageDto) => void
  onOrder: (kind: EStageKind, ids: string[]) => void
}) {
  const t = useT()
  const column = (kind: EStageKind, stages: StageDto[] = []) => {
    const move = (i: number, d: -1 | 1) => {
      const ids = stages.map((s) => s.id!)
      ;[ids[i], ids[i + d]] = [ids[i + d], ids[i]]
      onOrder(kind, ids)
    }
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{t(kind === "LEAD" ? "crm.leadStages" : "crm.dealStages")}</h3>
          {manage && (
            <Button variant="outline" size="sm" onClick={() => onAddStage(kind)}>
              <Plus className="size-4" /> {t("crm.stage.add")}
            </Button>
          )}
        </div>
        {stages.length === 0 && <p className="text-muted-foreground text-sm">{t("crm.stage.empty")}</p>}
        <ol className="flex flex-col gap-1">
          {stages.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
              <span className="text-muted-foreground w-5 text-xs">{i + 1}</span>
              <span className="flex-1">{s.name}</span>
              {manage && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={i === 0}
                    aria-label={t("crm.stage.up", { name: s.name ?? "" })}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={i === stages.length - 1}
                    aria-label={t("crm.stage.down", { name: s.name ?? "" })}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <RowButtons name={s.name ?? ""} onEdit={() => onRenameStage(s)} onRemove={() => onRemoveStage(s)} />
                </>
              )}
            </li>
          ))}
        </ol>
      </div>
    )
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{pipeline.name}</CardTitle>
        {manage && <RowButtons name={pipeline.name ?? ""} onEdit={onRename} onRemove={onRemove} />}
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        {column("LEAD", pipeline.leadStages)}
        {column("DEAL", pipeline.dealStages)}
      </CardContent>
    </Card>
  )
}

function LabelDialog({
  state,
  pipelines,
  onClose,
  onSave,
}: {
  state?: { label?: LabelDto; pipelineId?: string }
  pipelines: PipelineDto[]
  onClose: () => void
  onSave: (id: string | undefined, body: { pipelineId: number; name: string; color: string }) => Promise<boolean>
}) {
  const t = useT()
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {state && <LabelForm key={state.label?.id ?? "new"} state={state} pipelines={pipelines} onClose={onClose} onSave={onSave} t={t} />}
      </DialogContent>
    </Dialog>
  )
}

function LabelForm({
  state,
  pipelines,
  onClose,
  onSave,
  t,
}: {
  state: { label?: LabelDto; pipelineId?: string }
  pipelines: PipelineDto[]
  onClose: () => void
  onSave: (id: string | undefined, body: { pipelineId: number; name: string; color: string }) => Promise<boolean>
  t: ReturnType<typeof useT>
}) {
  const [pipelineId, setPipelineId] = React.useState(state.label?.pipelineId ?? state.pipelineId ?? "")
  const [name, setName] = React.useState(state.label?.name ?? "")
  const [color, setColor] = React.useState(state.label?.color ?? "#2563eb")
  const [error, setError] = React.useState<string>()
  const [busy, setBusy] = React.useState(false)
  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return setError(t("crm.v.required"))
        if (name.trim().length > 100) return setError(t("crm.v.max", { n: 100 }))
        setBusy(true)
        const ok = await onSave(state.label?.id, { pipelineId: Number(pipelineId), name: name.trim(), color })
        setBusy(false)
        if (ok) onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>{t(state.label ? "crm.label.edit" : "crm.label.create")}</DialogTitle>
        <DialogDescription className="sr-only">{t("crm.labels")}</DialogDescription>
      </DialogHeader>
      <FormField id="label-pipeline" label={t("crm.pipeline")}>
        <PipelineSelect pipelines={pipelines} value={pipelineId} onChange={setPipelineId} />
      </FormField>
      <FormField id="label-name" label={t("crm.name")} error={error}>
        <Input id="label-name" value={name} onChange={(e) => (setName(e.target.value), setError(undefined))} />
      </FormField>
      <FormField id="label-color" label={t("crm.color")}>
        <Input id="label-color" type="color" className="h-9 w-20 p-1" value={color} onChange={(e) => setColor(e.target.value)} />
      </FormField>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={busy || !pipelineId}>
          {t("common.save")}
        </Button>
      </DialogFooter>
    </form>
  )
}
