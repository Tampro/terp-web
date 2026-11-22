"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getContractSchema, toNumber, type TContractSchema } from "@/lib/crm/crm.schema"
import {
  ContractService,
  type ContractDetail,
  type ContractForm,
  type ContractTypeDto,
  type EContractStatus,
} from "@/lib/crm/crm.service"
import type { CustomerOption } from "@/lib/sales/sales.service"
import { useT, type TranslationKey } from "@/lib/i18n"

import { errorMessage, FormField, today } from "./crm-kit"

export const CONTRACT_STATUSES: EContractStatus[] = ["PENDING", "ACTIVE", "CLOSED", "DECLINED"]
const plusYear = () => {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toLocaleDateString("en-CA")
}

/** The whole form as a PUT body (full replacement): also used by the detail page to save the agreement text. */
export function contractBody(d: ContractDetail, patch: Partial<ContractForm> = {}): ContractForm {
  const c = d.contract ?? {}
  return {
    subject: c.subject ?? "",
    customerId: Number(c.customerId),
    contractTypeId: Number(c.contractTypeId),
    value: c.value ?? null,
    startDate: c.startDate ?? "",
    endDate: c.endDate ?? "",
    status: c.status,
    description: d.description ?? null,
    ...patch,
  }
}

function toForm(d?: ContractDetail): TContractSchema {
  const c = d?.contract
  return {
    subject: c?.subject ?? "",
    customerId: c?.customerId ?? "",
    contractTypeId: c?.contractTypeId ?? "",
    value: c?.value === null || c?.value === undefined ? "" : String(c.value),
    startDate: c?.startDate ?? today(),
    endDate: c?.endDate ?? plusYear(),
    status: c?.status ?? "PENDING",
    description: d?.description ?? "",
  }
}

/** §7.5 contract form: Subject, Customer, Value, Start / End Date, Status, Contract Type (number from the prefix). */
export function ContractFormDialog({
  state,
  customers,
  types,
  nextNumber,
  onClose,
  onSaved,
}: {
  state: { detail?: ContractDetail } | null
  customers: CustomerOption[]
  types: ContractTypeDto[]
  /** e.g. CON0001, shown on create */
  nextNumber?: string
  onClose: () => void
  onSaved: (d: ContractDetail) => void
}) {
  const t = useT()
  const editId = state?.detail?.contract?.id
  const values = React.useMemo(() => toForm(state?.detail), [state])
  const form = useForm<TContractSchema>({ resolver: zodResolver(getContractSchema(t)), mode: "all", values })
  const { errors, isSubmitting } = form.formState
  const currentType = state?.detail?.contract?.contractTypeId
  const typeOptions = types.filter((x) => x.active || x.id === currentType) // CTR_007: inactive types only stay on old contracts

  async function onSubmit(v: TContractSchema) {
    const body: ContractForm = {
      subject: v.subject.trim(),
      customerId: Number(v.customerId),
      contractTypeId: Number(v.contractTypeId),
      value: v.value.trim() === "" ? null : toNumber(v.value),
      startDate: v.startDate,
      endDate: v.endDate,
      status: v.status,
      description: v.description.trim() ? v.description : null,
    }
    try {
      const saved = editId ? await ContractService.update(editId, body) : await ContractService.create(body)
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
            <DialogTitle>{t(editId ? "crm.contract.edit" : "crm.contract.create")}</DialogTitle>
            <DialogDescription>
              {editId ? state?.detail?.contract?.number : nextNumber ? t("crm.contract.nextNumber", { number: nextNumber }) : ""}
            </DialogDescription>
          </DialogHeader>
          <FormField id="ct-subject" label={t("crm.subject")} error={errors.subject?.message}>
            <Input id="ct-subject" {...form.register("subject")} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="ct-customer" label={t("crm.client")} error={errors.customerId?.message}>
              <Controller
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="ct-customer" className="w-full" aria-label={t("crm.client")}>
                      <SelectValue placeholder={t("crm.choose")} />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id ?? ""}>
                          {c.companyName ?? c.customerCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField id="ct-type" label={t("crm.contract.type")} error={errors.contractTypeId?.message}>
              <Controller
                control={form.control}
                name="contractTypeId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="ct-type" className="w-full" aria-label={t("crm.contract.type")}>
                      <SelectValue placeholder={t("crm.choose")} />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((x) => (
                        <SelectItem key={x.id} value={x.id ?? ""}>
                          {x.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField id="ct-value" label={t("crm.value")} error={errors.value?.message}>
              <Input id="ct-value" inputMode="decimal" {...form.register("value")} />
            </FormField>
            <FormField id="ct-status" label={t("crm.status")}>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="ct-status" className="w-full" aria-label={t("crm.status")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRACT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`crm.contractStatus.${s}` as TranslationKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField id="ct-start" label={t("crm.startDate")} error={errors.startDate?.message}>
              <Input id="ct-start" type="date" {...form.register("startDate")} />
            </FormField>
            <FormField id="ct-end" label={t("crm.endDate")} error={errors.endDate?.message}>
              <Input id="ct-end" type="date" {...form.register("endDate")} />
            </FormField>
          </div>
          {!editId && (
            <FormField id="ct-desc" label={t("crm.contract.agreement")} error={errors.description?.message}>
              <Textarea id="ct-desc" rows={4} {...form.register("description")} />
            </FormField>
          )}
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
