"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useT, type TranslationKey } from "@/lib/i18n"
import { ProjectService, type DuplicateForm, type ProjectDto } from "@/lib/project/project.service"
import { toNumber } from "@/lib/sales/sales.schema"

import { attempt, Field } from "./project-kit"
import type { ProjectLookups } from "./use-project-lookups"

type T = ReturnType<typeof useT>
// Limits from project-service ProjectForm: name ≤ 191, description ≤ 20000, end ≥ start (PRJ_007).
const schema = (t: T) =>
  z
    .object({
      name: z.string().trim().min(1, t("project.v.required")).max(191, t("sales.v.max", { n: 191 })),
      startDate: z.string(),
      endDate: z.string(),
      budget: z.string().refine((v) => v.trim() === "" || toNumber(v) >= 0, t("inventory.v.amount")),
      description: z.string().max(20000, t("sales.v.max", { n: 20000 })),
      userIds: z.array(z.string()),
    })
    .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, { path: ["endDate"], message: t("crm.v.endBeforeStart") })
type TProject = z.infer<ReturnType<typeof schema>>

/** §11.1 project form: Name, Start Date, End Date, Users, Budget, Description (PUT = full replacement). */
export function ProjectFormDialog({
  state,
  lookups,
  onClose,
  onSaved,
}: {
  state: { project?: ProjectDto } | null
  lookups: ProjectLookups
  onClose: () => void
  onSaved: (p: ProjectDto) => void
}) {
  const t = useT()
  const editId = state?.project?.id
  const values = React.useMemo<TProject>(
    () => ({
      name: state?.project?.name ?? "",
      startDate: state?.project?.startDate ?? "",
      endDate: state?.project?.endDate ?? "",
      budget: state?.project?.budget == null ? "" : String(state.project.budget),
      description: state?.project?.description ?? "",
      userIds: state?.project?.userIds ?? [],
    }),
    [state]
  )
  const form = useForm<TProject>({ resolver: zodResolver(schema(t)), mode: "all", values })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(v: TProject) {
    const body = {
      name: v.name.trim(),
      startDate: v.startDate || null,
      endDate: v.endDate || null,
      budget: v.budget.trim() === "" ? null : toNumber(v.budget),
      description: v.description.trim() || null,
      userIds: v.userIds.map(Number),
    }
    let saved: ProjectDto | undefined
    const ok = await attempt(async () => {
      saved = editId ? await ProjectService.update(editId, body) : await ProjectService.create(body)
    }, t("common.saved"))
    if (ok && saved) {
      onSaved(saved)
      onClose()
    }
  }

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>{t(editId ? "project.edit" : "project.create")}</DialogTitle>
            <DialogDescription className="sr-only">{t("menu.projects")}</DialogDescription>
          </DialogHeader>
          <Field id="pj-name" label={t("project.name")} error={errors.name?.message}>
            <Input id="pj-name" {...form.register("name")} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field id="pj-start" label={t("crm.startDate")}>
              <Input id="pj-start" type="date" {...form.register("startDate")} />
            </Field>
            <Field id="pj-end" label={t("crm.endDate")} error={errors.endDate?.message}>
              <Input id="pj-end" type="date" {...form.register("endDate")} />
            </Field>
          </div>
          <Field id="pj-budget" label={t("project.budget")} error={errors.budget?.message}>
            <Input id="pj-budget" inputMode="decimal" {...form.register("budget")} />
          </Field>
          <div className="grid gap-1.5">
            <Label>{t("project.users")}</Label>
            <Controller
              control={form.control}
              name="userIds"
              render={({ field }) => (
                <div className="grid max-h-36 gap-1.5 overflow-y-auto rounded-md border p-2">
                  {lookups.users.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={field.value.includes(u.id ?? "")}
                        onCheckedChange={(c) => field.onChange(c === true ? [...field.value, u.id ?? ""] : field.value.filter((x) => x !== u.id))}
                      />
                      {u.fullName || u.username}
                    </label>
                  ))}
                </div>
              )}
            />
          </div>
          <Field id="pj-desc" label={t("crm.description")} error={errors.description?.message}>
            <Textarea id="pj-desc" rows={3} {...form.register("description")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const COPY = ["tasks", "bugs", "milestones", "team", "clients", "files", "activity"] as const

/** §11.1 Duplicate with options: tasks (subtasks, comments), bugs, activity, team, clients, milestones, files. */
export function DuplicateDialog({ project, onClose, onDone }: { project?: ProjectDto; onClose: () => void; onDone: () => void }) {
  const t = useT()
  return (
    <Dialog open={!!project} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">{project && <DuplicateForm_ key={project.id} project={project} onClose={onClose} onDone={onDone} t={t} />}</DialogContent>
    </Dialog>
  )
}

function DuplicateForm_({ project, onClose, onDone, t }: { project: ProjectDto; onClose: () => void; onDone: () => void; t: T }) {
  const [name, setName] = React.useState(`${project.name ?? ""} (copy)`.slice(0, 191))
  const [copy, setCopy] = React.useState<Record<(typeof COPY)[number], boolean>>({ tasks: true, bugs: true, milestones: true, team: true, clients: true, files: false, activity: false })
  const [busy, setBusy] = React.useState(false)
  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        const body: DuplicateForm = { name: name.trim() || undefined, ...copy }
        const ok = await attempt(() => ProjectService.duplicate(project.id!, body), t("project.done.duplicated"))
        setBusy(false)
        if (ok) {
          onDone()
          onClose()
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("project.duplicate.title", { name: project.name ?? "" })}</DialogTitle>
        <DialogDescription>{t("project.duplicate.desc")}</DialogDescription>
      </DialogHeader>
      <Field id="dup-name" label={t("project.name")}>
        <Input id="dup-name" value={name} maxLength={191} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        {COPY.map((k) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <Checkbox checked={copy[k]} onCheckedChange={(c) => setCopy((s) => ({ ...s, [k]: c === true }))} />
            {t(`project.duplicate.${k}` as TranslationKey)}
          </label>
        ))}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={busy}>
          {t("crm.action.duplicate")}
        </Button>
      </DialogFooter>
    </form>
  )
}
