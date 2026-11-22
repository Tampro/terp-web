"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getLeadSchema, type TLeadSchema } from "@/lib/crm/crm.schema"
import { LeadService, type LeadDetail, type LeadForm } from "@/lib/crm/crm.service"
import { useT } from "@/lib/i18n"

import { errorMessage, FormField, PipelineSelect } from "./crm-kit"
import { userName, type CrmLookups } from "./use-crm-lookups"

const FIRST = "__first"

function toForm(d: LeadDetail | undefined, pipelineId?: string, me?: string): TLeadSchema {
  const l = d?.lead
  return {
    pipelineId: l?.pipelineId ?? pipelineId ?? "",
    stageId: l?.stageId ?? "",
    name: l?.name ?? "",
    email: l?.email ?? "",
    subject: l?.subject ?? "",
    ownerUserId: l?.ownerUserId ?? me ?? "",
    phone: l?.phone ?? "",
    followUpDate: l?.followUpDate ?? "",
    notes: d?.notes ?? "",
  }
}

/** §7.2 lead form: Name, Email, Subject, assigned User, Phone, Follow Up Date (+ pipeline / first stage on create). */
export function LeadFormDialog({
  state,
  lookups,
  pipelineId,
  meId,
  onClose,
  onSaved,
}: {
  /** null = closed; {} = new; {detail} = edit (PUT = full replacement) */
  state: { detail?: LeadDetail } | null
  lookups: CrmLookups
  pipelineId?: string
  meId?: string
  onClose: () => void
  onSaved: (d: LeadDetail) => void
}) {
  const t = useT()
  const editId = state?.detail?.lead?.id
  const values = React.useMemo(() => toForm(state?.detail, pipelineId, meId), [state, pipelineId, meId])
  const form = useForm<TLeadSchema>({ resolver: zodResolver(getLeadSchema(t)), mode: "all", values })
  const { errors, isSubmitting } = form.formState
  const chosenPipeline = useWatch({ control: form.control, name: "pipelineId" })
  const stages = lookups.pipelines.find((p) => p.id === chosenPipeline)?.leadStages ?? []

  async function onSubmit(v: TLeadSchema) {
    const body: LeadForm = {
      pipelineId: Number(v.pipelineId),
      ...(!editId && v.stageId ? { stageId: Number(v.stageId) } : {}),
      name: v.name.trim(),
      email: v.email.trim(),
      subject: v.subject.trim(),
      ownerUserId: Number(v.ownerUserId),
      phone: v.phone.trim() || null,
      followUpDate: v.followUpDate || null,
      notes: v.notes.trim() || null,
    }
    try {
      const saved = editId ? await LeadService.update(editId, body) : await LeadService.create(body)
      toast.success(t("common.saved"))
      onSaved(saved)
      onClose()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const text = (name: "name" | "email" | "subject" | "phone", label: string, type = "text") => (
    <FormField id={`lead-${name}`} label={label} error={errors[name]?.message}>
      <Input id={`lead-${name}`} type={type} {...form.register(name)} />
    </FormField>
  )

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>{t(editId ? "crm.lead.edit" : "crm.lead.create")}</DialogTitle>
            <DialogDescription>{t("crm.lead.formDesc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="lead-pipeline" label={t("crm.pipeline")} error={errors.pipelineId?.message}>
              <Controller
                control={form.control}
                name="pipelineId"
                render={({ field }) =>
                  editId ? (
                    <Input id="lead-pipeline" disabled value={lookups.pipelines.find((p) => p.id === field.value)?.name ?? ""} />
                  ) : (
                    <PipelineSelect pipelines={lookups.pipelines} value={field.value} onChange={(v) => (field.onChange(v), form.setValue("stageId", ""))} />
                  )
                }
              />
            </FormField>
            {!editId && (
              <FormField id="lead-stage" label={t("crm.stage")}>
                <Controller
                  control={form.control}
                  name="stageId"
                  render={({ field }) => (
                    <Select value={field.value || FIRST} onValueChange={(v) => field.onChange(v === FIRST ? "" : v)}>
                      <SelectTrigger id="lead-stage" className="w-full" aria-label={t("crm.stage")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={FIRST}>{t("crm.firstStage")}</SelectItem>
                        {stages.map((s) => (
                          <SelectItem key={s.id} value={s.id ?? ""}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            )}
            {text("name", t("crm.name"))}
            {text("email", t("crm.email"), "email")}
            {text("subject", t("crm.subject"))}
            <FormField id="lead-owner" label={t("crm.owner")} error={errors.ownerUserId?.message}>
              <Controller
                control={form.control}
                name="ownerUserId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="lead-owner" className="w-full" aria-label={t("crm.owner")}>
                      <SelectValue placeholder={t("crm.choose")}>{field.value ? userName(lookups.users, field.value) : undefined}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {lookups.users.map((u) => (
                        <SelectItem key={u.id} value={u.id ?? ""}>
                          {u.fullName || u.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            {text("phone", t("crm.phone"), "tel")}
            <FormField id="lead-followUp" label={t("crm.followUp")} error={errors.followUpDate?.message}>
              <Input id="lead-followUp" type="date" {...form.register("followUpDate")} />
            </FormField>
          </div>
          <FormField id="lead-notes" label={t("crm.notes")} error={errors.notes?.message}>
            <Textarea id="lead-notes" rows={3} {...form.register("notes")} />
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
