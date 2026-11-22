"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getDealSchema, toNumber, type TDealSchema } from "@/lib/crm/crm.schema"
import { DealService, type DealDetail, type DealForm } from "@/lib/crm/crm.service"
import { useT } from "@/lib/i18n"

import { errorMessage, FormField, PipelineSelect } from "./crm-kit"
import type { CrmLookups } from "./use-crm-lookups"

const FIRST = "__first"

function toForm(d: DealDetail | undefined, pipelineId?: string): TDealSchema {
  const x = d?.deal
  return {
    pipelineId: x?.pipelineId ?? pipelineId ?? "",
    stageId: x?.stageId ?? "",
    name: x?.name ?? "",
    price: x?.price === undefined ? "" : String(x.price),
    phone: x?.phone ?? "",
    clientIds: (x?.clients ?? []).map((c) => c.refId ?? "").filter(Boolean),
    notes: d?.notes ?? "",
  }
}

/** §7.3 deal form: Deal Name, Price, Phone, Clients (accounting customers). */
export function DealFormDialog({
  state,
  lookups,
  pipelineId,
  onClose,
  onSaved,
}: {
  state: { detail?: DealDetail } | null
  lookups: CrmLookups
  pipelineId?: string
  onClose: () => void
  onSaved: (d: DealDetail) => void
}) {
  const t = useT()
  const editId = state?.detail?.deal?.id
  const values = React.useMemo(() => toForm(state?.detail, pipelineId), [state, pipelineId])
  const form = useForm<TDealSchema>({ resolver: zodResolver(getDealSchema(t)), mode: "all", values })
  const { errors, isSubmitting } = form.formState
  const chosenPipeline = useWatch({ control: form.control, name: "pipelineId" })
  const stages = lookups.pipelines.find((p) => p.id === chosenPipeline)?.dealStages ?? []

  async function onSubmit(v: TDealSchema) {
    const body: DealForm = {
      pipelineId: Number(v.pipelineId),
      ...(!editId && v.stageId ? { stageId: Number(v.stageId) } : {}),
      name: v.name.trim(),
      price: toNumber(v.price),
      phone: v.phone.trim() || null,
      clientIds: v.clientIds.map(Number),
      notes: v.notes.trim() || null,
    }
    try {
      const saved = editId ? await DealService.update(editId, body) : await DealService.create(body)
      toast.success(t("common.saved"))
      onSaved(saved)
      onClose()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>{t(editId ? "crm.deal.edit" : "crm.deal.create")}</DialogTitle>
            <DialogDescription>{t("crm.deal.formDesc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="deal-pipeline" label={t("crm.pipeline")} error={errors.pipelineId?.message}>
              <Controller
                control={form.control}
                name="pipelineId"
                render={({ field }) =>
                  editId ? (
                    <Input id="deal-pipeline" disabled value={lookups.pipelines.find((p) => p.id === field.value)?.name ?? ""} />
                  ) : (
                    <PipelineSelect pipelines={lookups.pipelines} value={field.value} onChange={(v) => (field.onChange(v), form.setValue("stageId", ""))} />
                  )
                }
              />
            </FormField>
            {!editId && (
              <FormField id="deal-stage" label={t("crm.stage")}>
                <Controller
                  control={form.control}
                  name="stageId"
                  render={({ field }) => (
                    <Select value={field.value || FIRST} onValueChange={(v) => field.onChange(v === FIRST ? "" : v)}>
                      <SelectTrigger id="deal-stage" className="w-full" aria-label={t("crm.stage")}>
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
            <FormField id="deal-name" label={t("crm.deal.name")} error={errors.name?.message}>
              <Input id="deal-name" {...form.register("name")} />
            </FormField>
            <FormField id="deal-price" label={t("crm.price")} error={errors.price?.message}>
              <Input id="deal-price" inputMode="decimal" {...form.register("price")} />
            </FormField>
            <FormField id="deal-phone" label={t("crm.phone")} error={errors.phone?.message}>
              <Input id="deal-phone" type="tel" {...form.register("phone")} />
            </FormField>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("crm.clients")}</Label>
            <Controller
              control={form.control}
              name="clientIds"
              render={({ field }) => (
                <div className="grid max-h-36 gap-1.5 overflow-y-auto rounded-md border p-2">
                  {lookups.customers.length === 0 && <p className="text-muted-foreground text-sm">{t("crm.noOptions")}</p>}
                  {lookups.customers.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={field.value.includes(c.id ?? "")}
                        onCheckedChange={(on) =>
                          field.onChange(on === true ? [...field.value, c.id ?? ""] : field.value.filter((x) => x !== c.id))
                        }
                      />
                      {c.companyName ?? c.customerCode}
                    </label>
                  ))}
                </div>
              )}
            />
          </div>
          <FormField id="deal-notes" label={t("crm.notes")} error={errors.notes?.message}>
            <Textarea id="deal-notes" rows={3} {...form.register("notes")} />
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
