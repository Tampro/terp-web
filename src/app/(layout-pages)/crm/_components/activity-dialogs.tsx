"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  getCallSchema,
  getEmailSchema,
  getTaskSchema,
  type TCallSchema,
  type TEmailSchema,
  type TTaskSchema,
} from "@/lib/crm/crm.schema"
import type { CallDto, CallForm, CrmUserOption, TaskDto, TaskForm } from "@/lib/crm/crm.service"
import { useT, type TranslationKey } from "@/lib/i18n"

import { FormField, today } from "./crm-kit"

const NONE = "__none"

function EnumSelect<V extends string>({
  id,
  label,
  value,
  values,
  prefix,
  onChange,
}: {
  id: string
  label: string
  value: V
  values: readonly V[]
  prefix: string
  onChange: (v: V) => void
}) {
  const t = useT()
  return (
    <Select value={value} onValueChange={(v) => onChange(v as V)}>
      <SelectTrigger id={id} className="w-full" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {values.map((v) => (
          <SelectItem key={v} value={v}>
            {t(`${prefix}.${v}` as TranslationKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** §7.2 detail → Tasks: name, date, time, priority, status. */
export function TaskDialog({
  state,
  onClose,
  onSave,
}: {
  state: { task?: TaskDto } | null
  onClose: () => void
  onSave: (body: TaskForm, id?: string) => Promise<boolean>
}) {
  const t = useT()
  const values = React.useMemo<TTaskSchema>(
    () => ({
      name: state?.task?.name ?? "",
      date: state?.task?.date ?? today(),
      time: state?.task?.time?.slice(0, 5) ?? "",
      priority: state?.task?.priority ?? "MEDIUM",
      status: state?.task?.status ?? "OPEN",
    }),
    [state]
  )
  const form = useForm<TTaskSchema>({ resolver: zodResolver(getTaskSchema(t)), mode: "all", values })
  const { errors, isSubmitting } = form.formState
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          noValidate
          onSubmit={form.handleSubmit(async (v) => {
            const ok = await onSave({ ...v, name: v.name.trim(), time: v.time || null }, state?.task?.id)
            if (ok) onClose()
          })}
        >
          <DialogHeader>
            <DialogTitle>{t(state?.task ? "crm.task.edit" : "crm.task.create")}</DialogTitle>
            <DialogDescription className="sr-only">{t("crm.tasks")}</DialogDescription>
          </DialogHeader>
          <FormField id="task-name" label={t("crm.name")} error={errors.name?.message}>
            <Input id="task-name" {...form.register("name")} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField id="task-date" label={t("crm.date")} error={errors.date?.message}>
              <Input id="task-date" type="date" {...form.register("date")} />
            </FormField>
            <FormField id="task-time" label={t("crm.time")}>
              <Input id="task-time" type="time" {...form.register("time")} />
            </FormField>
            <FormField id="task-priority" label={t("crm.priority")}>
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <EnumSelect id="task-priority" label={t("crm.priority")} value={field.value} values={["LOW", "MEDIUM", "HIGH"] as const} prefix="crm.priorityOf" onChange={field.onChange} />
                )}
              />
            </FormField>
            <FormField id="task-status" label={t("crm.status")}>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <EnumSelect id="task-status" label={t("crm.status")} value={field.value} values={["OPEN", "DONE"] as const} prefix="crm.taskStatus" onChange={field.onChange} />
                )}
              />
            </FormField>
          </div>
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

/** §7.2 detail → Calls: subject, type, duration, assignee, description, result. */
export function CallDialog({
  state,
  users,
  onClose,
  onSave,
}: {
  state: { call?: CallDto } | null
  users: CrmUserOption[]
  onClose: () => void
  onSave: (body: CallForm, id?: string) => Promise<boolean>
}) {
  const t = useT()
  const values = React.useMemo<TCallSchema>(
    () => ({
      subject: state?.call?.subject ?? "",
      callType: state?.call?.callType ?? "OUTBOUND",
      duration: state?.call?.duration ?? "",
      assigneeUserId: state?.call?.assigneeUserId ?? "",
      description: state?.call?.description ?? "",
      callResult: state?.call?.callResult ?? "",
    }),
    [state]
  )
  const form = useForm<TCallSchema>({ resolver: zodResolver(getCallSchema(t)), mode: "all", values })
  const { errors, isSubmitting } = form.formState
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="grid gap-4"
          noValidate
          onSubmit={form.handleSubmit(async (v) => {
            const ok = await onSave(
              {
                subject: v.subject.trim(),
                callType: v.callType,
                duration: v.duration.trim() || null,
                assigneeUserId: v.assigneeUserId ? Number(v.assigneeUserId) : null,
                description: v.description.trim() || null,
                callResult: v.callResult.trim() || null,
              },
              state?.call?.id
            )
            if (ok) onClose()
          })}
        >
          <DialogHeader>
            <DialogTitle>{t(state?.call ? "crm.call.edit" : "crm.call.create")}</DialogTitle>
            <DialogDescription className="sr-only">{t("crm.calls")}</DialogDescription>
          </DialogHeader>
          <FormField id="call-subject" label={t("crm.subject")} error={errors.subject?.message}>
            <Input id="call-subject" {...form.register("subject")} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField id="call-type" label={t("crm.call.type")}>
              <Controller
                control={form.control}
                name="callType"
                render={({ field }) => (
                  <EnumSelect id="call-type" label={t("crm.call.type")} value={field.value} values={["INBOUND", "OUTBOUND"] as const} prefix="crm.callType" onChange={field.onChange} />
                )}
              />
            </FormField>
            <FormField id="call-duration" label={t("crm.call.duration")} error={errors.duration?.message}>
              <Input id="call-duration" placeholder="00:15:00" {...form.register("duration")} />
            </FormField>
          </div>
          <FormField id="call-assignee" label={t("crm.call.assignee")}>
            <Controller
              control={form.control}
              name="assigneeUserId"
              render={({ field }) => (
                <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                  <SelectTrigger id="call-assignee" className="w-full" aria-label={t("crm.call.assignee")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("crm.none")}</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id ?? ""}>
                        {u.fullName || u.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField id="call-desc" label={t("crm.description")} error={errors.description?.message}>
            <Textarea id="call-desc" rows={2} {...form.register("description")} />
          </FormField>
          <FormField id="call-result" label={t("crm.call.result")} error={errors.callResult?.message}>
            <Textarea id="call-result" rows={2} {...form.register("callResult")} />
          </FormField>
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

/** §7.2 detail → General → Emails: logged on the record, not sent. */
export function EmailDialog({
  open,
  defaultTo,
  onClose,
  onSave,
}: {
  open: boolean
  defaultTo?: string
  onClose: () => void
  onSave: (body: { to: string; subject: string; body: string }) => Promise<boolean>
}) {
  const t = useT()
  const values = React.useMemo<TEmailSchema>(() => ({ to: defaultTo ?? "", subject: "", body: "" }), [defaultTo])
  const form = useForm<TEmailSchema>({ resolver: zodResolver(getEmailSchema(t)), mode: "all", values })
  const { errors, isSubmitting } = form.formState
  return (
    <Dialog open={open} onOpenChange={(o) => !o && (onClose(), form.reset(values))}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="grid gap-4"
          noValidate
          onSubmit={form.handleSubmit(async (v) => {
            if (await onSave({ to: v.to.trim(), subject: v.subject.trim(), body: v.body.trim() })) {
              form.reset(values)
              onClose()
            }
          })}
        >
          <DialogHeader>
            <DialogTitle>{t("crm.email.create")}</DialogTitle>
            <DialogDescription>{t("crm.email.desc")}</DialogDescription>
          </DialogHeader>
          <FormField id="mail-to" label={t("crm.email.to")} error={errors.to?.message}>
            <Input id="mail-to" type="email" {...form.register("to")} />
          </FormField>
          <FormField id="mail-subject" label={t("crm.subject")} error={errors.subject?.message}>
            <Input id="mail-subject" {...form.register("subject")} />
          </FormField>
          <FormField id="mail-body" label={t("crm.email.body")} error={errors.body?.message}>
            <Textarea id="mail-body" rows={5} {...form.register("body")} />
          </FormField>
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
