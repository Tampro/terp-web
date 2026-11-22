"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2 } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { CrmUserOption } from "@/lib/crm/crm.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import {
  BugService,
  ProjectService,
  TaskService,
  type BugDto,
  type MilestoneDto,
  type StageDto,
  type TaskDetailDto,
  type TaskDto,
} from "@/lib/project/project.service"
import { toNumber } from "@/lib/sales/sales.schema"

import { attempt, Field } from "./project-kit"
import { userLabel } from "./use-project-lookups"

type T = ReturnType<typeof useT>
const NONE = "__none"
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const

function SimpleSelect({
  id,
  label,
  value,
  onChange,
  options,
  none,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  none?: string
}) {
  const t = useT()
  return (
    <Select value={value || (none ? NONE : "")} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger id={id} className="w-full" aria-label={label}>
        <SelectValue placeholder={t("sales.choose")} />
      </SelectTrigger>
      <SelectContent>
        {none && <SelectItem value={NONE}>{none}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const taskSchema = (t: T) =>
  z
    .object({
      title: z.string().trim().min(1, t("project.v.required")).max(191, t("sales.v.max", { n: 191 })),
      milestoneId: z.string(),
      priority: z.enum(PRIORITIES),
      stageId: z.string(),
      assigneeIds: z.array(z.string()),
      startDate: z.string(),
      dueDate: z.string(),
      description: z.string().max(20000, t("sales.v.max", { n: 20000 })),
    })
    .refine((v) => !v.startDate || !v.dueDate || v.dueDate >= v.startDate, { path: ["dueDate"], message: t("crm.v.endBeforeStart") })
type TTask = z.infer<ReturnType<typeof taskSchema>>

/**
 * §11.1 task form: milestone, title, priority, stage, assignees (project team, PRJ_017), start / due date (duration),
 * description; when editing also subtasks and comments.
 */
export function TaskDialog({
  state,
  projectId,
  team,
  users,
  stages,
  milestones,
  canEdit,
  onClose,
  onSaved,
}: {
  state: { task?: TaskDto } | null
  projectId: string
  team: string[]
  users: CrmUserOption[]
  stages: StageDto[]
  milestones: MilestoneDto[]
  canEdit: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        {state && (
          <TaskForm
            key={state.task?.id ?? "new"}
            task={state.task}
            projectId={projectId}
            team={team}
            users={users}
            stages={stages}
            milestones={milestones}
            canEdit={canEdit}
            onClose={onClose}
            onSaved={onSaved}
            t={t}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TaskForm({
  task,
  projectId,
  team,
  users,
  stages,
  milestones,
  canEdit,
  onClose,
  onSaved,
  t,
}: {
  task?: TaskDto
  projectId: string
  team: string[]
  users: CrmUserOption[]
  stages: StageDto[]
  milestones: MilestoneDto[]
  canEdit: boolean
  onClose: () => void
  onSaved: () => void
  t: T
}) {
  const language = useLanguageStore((s) => s.language)
  const form = useForm<TTask>({
    resolver: zodResolver(taskSchema(t)),
    mode: "all",
    defaultValues: {
      title: task?.title ?? "",
      milestoneId: task?.milestoneId ?? "",
      priority: task?.priority ?? "MEDIUM",
      stageId: task?.stageId ?? "",
      assigneeIds: task?.assigneeIds ?? [],
      startDate: task?.startDate ?? "",
      dueDate: task?.dueDate ?? "",
      description: task?.description ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState
  const [detail, setDetail] = React.useState<TaskDetailDto>()
  const [reloadKey, setReloadKey] = React.useState(0)
  const [subtask, setSubtask] = React.useState("")
  const [comment, setComment] = React.useState("")

  React.useEffect(() => {
    if (!task?.id) return
    let cancelled = false
    TaskService.get(task.id)
      .then((d) => !cancelled && setDetail(d))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [task?.id, reloadKey])
  const refresh = () => setReloadKey((x) => x + 1)

  async function onSubmit(v: TTask) {
    const body = {
      title: v.title.trim(),
      milestoneId: v.milestoneId ? Number(v.milestoneId) : null,
      priority: v.priority,
      stageId: v.stageId ? Number(v.stageId) : null,
      assigneeIds: v.assigneeIds.map(Number),
      startDate: v.startDate || null,
      dueDate: v.dueDate || null,
      description: v.description.trim() || null,
    }
    const ok = await attempt(() => (task?.id ? TaskService.update(task.id, body) : TaskService.create(projectId, body)), t("common.saved"))
    if (ok) {
      onSaved()
      onClose()
    }
  }

  return (
    <div className="grid gap-4">
      <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <DialogHeader>
          <DialogTitle>{t(task ? "project.task.edit" : "project.task.create")}</DialogTitle>
          <DialogDescription className="sr-only">{t("project.tab.tasks")}</DialogDescription>
        </DialogHeader>
        <Field id="tk-title" label={t("project.task.title")} error={errors.title?.message}>
          <Input id="tk-title" disabled={!canEdit} {...form.register("title")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="tk-milestone" label={t("project.milestone.one")}>
            <Controller
              control={form.control}
              name="milestoneId"
              render={({ field }) => (
                <SimpleSelect
                  id="tk-milestone"
                  label={t("project.milestone.one")}
                  value={field.value}
                  onChange={field.onChange}
                  none={t("crm.none")}
                  options={milestones.map((m) => ({ value: m.id ?? "", label: m.title ?? "-" }))}
                />
              )}
            />
          </Field>
          <Field id="tk-priority" label={t("crm.priority")}>
            <Controller
              control={form.control}
              name="priority"
              render={({ field }) => (
                <SimpleSelect
                  id="tk-priority"
                  label={t("crm.priority")}
                  value={field.value}
                  onChange={field.onChange}
                  options={PRIORITIES.map((p) => ({ value: p, label: t(`project.priority.${p}` as TranslationKey) }))}
                />
              )}
            />
          </Field>
          <Field id="tk-stage" label={t("crm.stage")}>
            <Controller
              control={form.control}
              name="stageId"
              render={({ field }) => (
                <SimpleSelect
                  id="tk-stage"
                  label={t("crm.stage")}
                  value={field.value}
                  onChange={field.onChange}
                  none={t("crm.firstStage")}
                  options={stages.map((s) => ({ value: s.id ?? "", label: s.name ?? "-" }))}
                />
              )}
            />
          </Field>
          <Field id="tk-start" label={t("crm.startDate")}>
            <Input id="tk-start" type="date" {...form.register("startDate")} />
          </Field>
          <Field id="tk-due" label={t("project.task.due")} error={errors.dueDate?.message}>
            <Input id="tk-due" type="date" {...form.register("dueDate")} />
          </Field>
          {task?.durationDays != null && (
            <div className="grid gap-1.5">
              <Label>{t("project.task.duration")}</Label>
              <p className="pt-2 text-sm">{t("project.task.days", { n: task.durationDays })}</p>
            </div>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label>{t("project.task.assignees")}</Label>
          {team.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("project.task.noTeam")}</p>
          ) : (
            <Controller
              control={form.control}
              name="assigneeIds"
              render={({ field }) => (
                <div className="flex flex-wrap gap-3 rounded-md border p-2">
                  {team.map((id) => (
                    <label key={id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={field.value.includes(id)} onCheckedChange={(c) => field.onChange(c === true ? [...field.value, id] : field.value.filter((x) => x !== id))} />
                      {userLabel(users, id)}
                    </label>
                  ))}
                </div>
              )}
            />
          )}
        </div>
        <Field id="tk-desc" label={t("crm.description")} error={errors.description?.message}>
          <Textarea id="tk-desc" rows={3} {...form.register("description")} />
        </Field>
        {canEdit && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        )}
      </form>

      {task?.id && (
        <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
          <section className="grid content-start gap-2">
            <h3 className="text-sm font-medium">{t("project.task.subtasks")}</h3>
            {!detail && <Skeleton className="h-10 w-full" />}
            {(detail?.subtasks ?? []).map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={!!s.done}
                  disabled={!canEdit}
                  aria-label={s.name}
                  onCheckedChange={async (c) => (await attempt(() => TaskService.updateSubtask(s.id!, s.name ?? "", c === true))) && refresh()}
                />
                <span className={`flex-1 ${s.done ? "text-muted-foreground line-through" : ""}`}>{s.name}</span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label={t("crm.deleteNamed", { name: s.name ?? "" })}
                    onClick={async () => (await attempt(() => TaskService.removeSubtask(s.id!))) && refresh()}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {canEdit && (
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault()
                  const n = subtask.trim()
                  if (!n || n.length > 191) return
                  if (await attempt(() => TaskService.addSubtask(task.id!, n))) {
                    setSubtask("")
                    refresh()
                  }
                }}
              >
                <Input value={subtask} onChange={(e) => setSubtask(e.target.value)} placeholder={t("project.task.addSubtask")} aria-label={t("project.task.addSubtask")} />
                <Button type="submit" variant="secondary" disabled={!subtask.trim()}>
                  {t("crm.stage.add")}
                </Button>
              </form>
            )}
          </section>
          <section className="grid content-start gap-2">
            <h3 className="text-sm font-medium">{t("project.task.comments")}</h3>
            {(detail?.comments ?? []).map((c) => (
              <div key={c.id} className="rounded-md border p-2 text-sm">
                <p className="whitespace-pre-wrap">{c.body}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {userLabel(users, c.authorUserId)} · {formatDate(c.createdDate, language, true)}
                </p>
              </div>
            ))}
            <form
              className="grid gap-2"
              onSubmit={async (e) => {
                e.preventDefault()
                const b = comment.trim()
                if (!b || b.length > 5000) return
                if (await attempt(() => TaskService.addComment(task.id!, b))) {
                  setComment("")
                  refresh()
                }
              }}
            >
              <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("crm.discussion.placeholder")} aria-label={t("project.task.comments")} />
              <div>
                <Button type="submit" size="sm" disabled={!comment.trim()}>
                  {t("crm.discussion.add")}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

const bugSchema = (t: T) =>
  z.object({
    title: z.string().trim().min(1, t("project.v.required")).max(191, t("sales.v.max", { n: 191 })),
    priority: z.enum(PRIORITIES),
    assigneeId: z.string(),
    stageId: z.string(),
    description: z.string().max(20000, t("sales.v.max", { n: 20000 })),
  })
type TBug = z.infer<ReturnType<typeof bugSchema>>

/** §11.1 bug form: title, priority, assignee, status (stage), description. */
export function BugDialog({
  state,
  projectId,
  team,
  users,
  stages,
  onClose,
  onSaved,
}: {
  state: { bug?: BugDto } | null
  projectId: string
  team: string[]
  users: CrmUserOption[]
  stages: StageDto[]
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const values = React.useMemo<TBug>(
    () => ({
      title: state?.bug?.title ?? "",
      priority: state?.bug?.priority ?? "MEDIUM",
      assigneeId: state?.bug?.assigneeId ?? "",
      stageId: state?.bug?.stageId ?? "",
      description: state?.bug?.description ?? "",
    }),
    [state]
  )
  const form = useForm<TBug>({ resolver: zodResolver(bugSchema(t)), mode: "all", values })
  const { errors, isSubmitting } = form.formState
  const editId = state?.bug?.id
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="grid gap-4"
          noValidate
          onSubmit={form.handleSubmit(async (v) => {
            const body = {
              title: v.title.trim(),
              priority: v.priority,
              assigneeId: v.assigneeId ? Number(v.assigneeId) : null,
              stageId: v.stageId ? Number(v.stageId) : null,
              description: v.description.trim() || null,
            }
            if (await attempt(() => (editId ? BugService.update(editId, body) : BugService.create(projectId, body)), t("common.saved"))) {
              onSaved()
              onClose()
            }
          })}
        >
          <DialogHeader>
            <DialogTitle>{t(editId ? "project.bug.edit" : "project.bug.create")}</DialogTitle>
            <DialogDescription className="sr-only">{t("project.tab.bugs")}</DialogDescription>
          </DialogHeader>
          <Field id="bg-title" label={t("project.task.title")} error={errors.title?.message}>
            <Input id="bg-title" {...form.register("title")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="bg-priority" label={t("crm.priority")}>
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <SimpleSelect id="bg-priority" label={t("crm.priority")} value={field.value} onChange={field.onChange} options={PRIORITIES.map((p) => ({ value: p, label: t(`project.priority.${p}` as TranslationKey) }))} />
                )}
              />
            </Field>
            <Field id="bg-assignee" label={t("crm.call.assignee")}>
              <Controller
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                  <SimpleSelect id="bg-assignee" label={t("crm.call.assignee")} value={field.value} onChange={field.onChange} none={t("crm.none")} options={team.map((id) => ({ value: id, label: userLabel(users, id) }))} />
                )}
              />
            </Field>
            <Field id="bg-stage" label={t("crm.status")}>
              <Controller
                control={form.control}
                name="stageId"
                render={({ field }) => (
                  <SimpleSelect id="bg-stage" label={t("crm.status")} value={field.value} onChange={field.onChange} none={t("crm.firstStage")} options={stages.map((s) => ({ value: s.id ?? "", label: s.name ?? "-" }))} />
                )}
              />
            </Field>
          </div>
          <Field id="bg-desc" label={t("crm.description")} error={errors.description?.message}>
            <Textarea id="bg-desc" rows={3} {...form.register("description")} />
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

const MILESTONE_STATUSES = ["INCOMPLETE", "ONGOING", "COMPLETE"] as const
const milestoneSchema = (t: T) =>
  z
    .object({
      title: z.string().trim().min(1, t("project.v.required")).max(191, t("sales.v.max", { n: 191 })),
      cost: z.string().refine((v) => v.trim() === "" || toNumber(v) >= 0, t("inventory.v.amount")),
      startDate: z.string(),
      endDate: z.string(),
      summary: z.string().max(20000, t("sales.v.max", { n: 20000 })),
      status: z.enum(MILESTONE_STATUSES),
      progress: z.string().refine((v) => v.trim() === "" || (/^\d+$/.test(v.trim()) && Number(v) <= 100), t("project.v.progress")),
    })
    .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, { path: ["endDate"], message: t("crm.v.endBeforeStart") })
type TMilestone = z.infer<ReturnType<typeof milestoneSchema>>

/** §11.1 milestone: title, cost, start, end, summary, status, progress (0..100). */
export function MilestoneDialog({
  state,
  projectId,
  onClose,
  onSaved,
}: {
  state: { milestone?: MilestoneDto } | null
  projectId: string
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const m = state?.milestone
  const values = React.useMemo<TMilestone>(
    () => ({
      title: m?.title ?? "",
      cost: m?.cost == null ? "" : String(m.cost),
      startDate: m?.startDate ?? "",
      endDate: m?.endDate ?? "",
      summary: m?.summary ?? "",
      status: m?.status ?? "INCOMPLETE",
      progress: m?.progress == null ? "" : String(m.progress),
    }),
    [m]
  )
  const form = useForm<TMilestone>({ resolver: zodResolver(milestoneSchema(t)), mode: "all", values })
  const { errors, isSubmitting } = form.formState
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="grid gap-4"
          noValidate
          onSubmit={form.handleSubmit(async (v) => {
            const body = {
              title: v.title.trim(),
              cost: v.cost.trim() === "" ? null : toNumber(v.cost),
              startDate: v.startDate || null,
              endDate: v.endDate || null,
              summary: v.summary.trim() || null,
              status: v.status,
              progress: v.progress.trim() === "" ? null : Number(v.progress),
            }
            if (await attempt(() => (m?.id ? ProjectService.updateMilestone(m.id, body) : ProjectService.addMilestone(projectId, body)), t("common.saved"))) {
              onSaved()
              onClose()
            }
          })}
        >
          <DialogHeader>
            <DialogTitle>{t(m ? "project.milestone.edit" : "project.milestone.create")}</DialogTitle>
            <DialogDescription className="sr-only">{t("project.tab.milestones")}</DialogDescription>
          </DialogHeader>
          <Field id="ms-title" label={t("project.task.title")} error={errors.title?.message}>
            <Input id="ms-title" {...form.register("title")} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field id="ms-cost" label={t("project.milestone.cost")} error={errors.cost?.message}>
              <Input id="ms-cost" inputMode="decimal" {...form.register("cost")} />
            </Field>
            <Field id="ms-status" label={t("crm.status")}>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <SimpleSelect
                    id="ms-status"
                    label={t("crm.status")}
                    value={field.value}
                    onChange={field.onChange}
                    options={MILESTONE_STATUSES.map((s) => ({ value: s, label: t(`project.milestone.status.${s}` as TranslationKey) }))}
                  />
                )}
              />
            </Field>
            <Field id="ms-start" label={t("crm.startDate")}>
              <Input id="ms-start" type="date" {...form.register("startDate")} />
            </Field>
            <Field id="ms-end" label={t("crm.endDate")} error={errors.endDate?.message}>
              <Input id="ms-end" type="date" {...form.register("endDate")} />
            </Field>
            <Field id="ms-progress" label={t("project.progress")} error={errors.progress?.message}>
              <Input id="ms-progress" inputMode="numeric" {...form.register("progress")} />
            </Field>
          </div>
          <Field id="ms-summary" label={t("project.milestone.summary")} error={errors.summary?.message}>
            <Textarea id="ms-summary" rows={3} {...form.register("summary")} />
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
