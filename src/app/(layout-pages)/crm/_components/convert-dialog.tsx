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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getConvertSchema, toNumber, type TConvertSchema } from "@/lib/crm/crm.schema"
import { CONVERT_COPY, LeadService, type ConvertForm, type LeadRow } from "@/lib/crm/crm.service"
import { useT, type TranslationKey } from "@/lib/i18n"

import { errorMessage, FormField } from "./crm-kit"
import type { CrmLookups } from "./use-crm-lookups"

/**
 * §7.2 Convert to Deal: deal name, price; an existing client or a new one (created in accounting, CUSTOMER_MANAGE);
 * what to copy. A lead converts once (CRM_011). The deal starts at the pipeline's first deal stage.
 */
export function ConvertDialog({
  lead,
  lookups,
  onClose,
  onConverted,
}: {
  lead?: LeadRow
  lookups: CrmLookups
  onClose: () => void
  onConverted: (dealId: string) => void
}) {
  const t = useT()
  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {lead && <ConvertForm_ key={lead.id} lead={lead} lookups={lookups} onClose={onClose} onConverted={onConverted} t={t} />}
      </DialogContent>
    </Dialog>
  )
}

function ConvertForm_({
  lead,
  lookups,
  onClose,
  onConverted,
  t,
}: {
  lead: LeadRow
  lookups: CrmLookups
  onClose: () => void
  onConverted: (dealId: string) => void
  t: ReturnType<typeof useT>
}) {
  const form = useForm<TConvertSchema>({
    resolver: zodResolver(getConvertSchema(t)),
    mode: "all",
    defaultValues: {
      dealName: lead.subject ?? "",
      price: "",
      clientMode: "new",
      customerId: "",
      companyName: lead.name ?? "",
      contactPerson: lead.name ?? "",
      email: lead.email ?? "",
      mobile: lead.phone ?? "",
      copy: [...CONVERT_COPY],
    },
  })
  const { errors, isSubmitting } = form.formState
  const mode = useWatch({ control: form.control, name: "clientMode" })

  async function onSubmit(v: TConvertSchema) {
    const body: ConvertForm = {
      dealName: v.dealName.trim() || undefined,
      price: v.price.trim() === "" ? undefined : toNumber(v.price),
      ...(v.clientMode === "existing"
        ? { customerId: Number(v.customerId) }
        : {
            newClient: {
              companyName: v.companyName.trim(),
              contactPerson: v.contactPerson.trim() || undefined,
              email: v.email.trim() || undefined,
              mobile: v.mobile.trim() || undefined,
            },
          }),
      copy: v.copy,
    }
    try {
      const r = await LeadService.convert(lead.id!, body)
      toast.success(t("crm.done.converted"))
      onConverted(r.dealId ?? "")
      onClose()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <DialogHeader>
        <DialogTitle>{t("crm.convert.title", { name: lead.name ?? "" })}</DialogTitle>
        <DialogDescription>{t("crm.convert.desc")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="cv-dealName" label={t("crm.deal.name")} error={errors.dealName?.message}>
          <Input id="cv-dealName" {...form.register("dealName")} />
        </FormField>
        <FormField id="cv-price" label={t("crm.price")} error={errors.price?.message}>
          <Input id="cv-price" inputMode="decimal" {...form.register("price")} />
        </FormField>
      </div>
      <Controller
        control={form.control}
        name="clientMode"
        render={({ field }) => (
          <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-6" aria-label={t("crm.client")}>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="new" /> {t("crm.convert.newClient")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="existing" /> {t("crm.convert.existingClient")}
            </label>
          </RadioGroup>
        )}
      />
      {mode === "existing" ? (
        <FormField id="cv-customer" label={t("crm.client")} error={errors.customerId?.message}>
          <Controller
            control={form.control}
            name="customerId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="cv-customer" className="w-full" aria-label={t("crm.client")}>
                  <SelectValue placeholder={t("crm.choose")} />
                </SelectTrigger>
                <SelectContent>
                  {lookups.customers.map((c) => (
                    <SelectItem key={c.id} value={c.id ?? ""}>
                      {c.companyName ?? c.customerCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="cv-company" label={t("crm.convert.companyName")} error={errors.companyName?.message}>
            <Input id="cv-company" {...form.register("companyName")} />
          </FormField>
          <FormField id="cv-contact" label={t("crm.convert.contactPerson")} error={errors.contactPerson?.message}>
            <Input id="cv-contact" {...form.register("contactPerson")} />
          </FormField>
          <FormField id="cv-email" label={t("crm.email")} error={errors.email?.message}>
            <Input id="cv-email" type="email" {...form.register("email")} />
          </FormField>
          <FormField id="cv-mobile" label={t("crm.phone")} error={errors.mobile?.message}>
            <Input id="cv-mobile" type="tel" {...form.register("mobile")} />
          </FormField>
        </div>
      )}
      <div className="grid gap-2">
        <Label>{t("crm.convert.copy")}</Label>
        <Controller
          control={form.control}
          name="copy"
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {CONVERT_COPY.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={field.value.includes(c)}
                    onCheckedChange={(on) => field.onChange(on === true ? [...field.value, c] : field.value.filter((x) => x !== c))}
                  />
                  {t(`crm.copy.${c}` as TranslationKey)}
                </label>
              ))}
            </div>
          )}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {t("crm.action.convert")}
        </Button>
      </DialogFooter>
    </form>
  )
}
