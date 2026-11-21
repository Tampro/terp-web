"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Copy } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { FieldError, PasswordInput } from "@/components/auth/password-input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  getCompanyCreateSchema,
  getCompanyPasswordSchema,
  getCompanyUpdateSchema,
  type TCompanyCreateSchema,
  type TCompanyPasswordSchema,
  type TCompanyUpdateSchema,
} from "@/lib/admin/admin.schema"
import { CompanyService, type CompanyDto } from "@/lib/admin/admin.service"
import { useT } from "@/lib/i18n"

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
      <FieldError message={error} />
    </div>
  )
}

/** POST /iam/companies: company + first COMPANY_ADMIN. The temporary password comes back once and is shown once. */
export function CreateCompanyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: () => void
}) {
  const t = useT()
  const [created, setCreated] = React.useState<{ username?: string; password?: string }>()
  const form = useForm<TCompanyCreateSchema>({
    resolver: zodResolver(getCompanyCreateSchema(t)),
    mode: "all",
    defaultValues: { code: "", name: "", email: "", enableLogin: true, adminUsername: "", adminEmail: "", adminFullName: "" },
  })
  const { errors, isSubmitting } = form.formState

  function close(o: boolean) {
    if (!o) {
      form.reset()
      setCreated(undefined)
    }
    onOpenChange(o)
  }

  async function onSubmit(v: TCompanyCreateSchema) {
    try {
      const res = await CompanyService.create({
        code: v.code,
        name: v.name,
        email: v.email,
        enableLogin: v.enableLogin,
        admin: { username: v.adminUsername, email: v.adminEmail, fullName: v.adminFullName },
      })
      setCreated({ username: res?.admin?.user?.username ?? v.adminUsername, password: res?.admin?.temporaryPassword })
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("companies.create")}</DialogTitle>
          <DialogDescription>{t("companies.createDesc")}</DialogDescription>
        </DialogHeader>
        {created ? (
          <div className="grid gap-3">
            <Alert>
              <AlertDescription>{t("companies.tempPasswordOnce")}</AlertDescription>
            </Alert>
            <div className="grid gap-1 text-sm">
              <span className="text-muted-foreground">{t("companies.adminUsername")}</span>
              <span className="font-medium">{created.username}</span>
            </div>
            <div className="grid gap-1 text-sm">
              <span className="text-muted-foreground">{t("companies.tempPassword")}</span>
              <div className="flex items-center gap-2">
                <code className="bg-muted rounded px-2 py-1" data-testid="temp-password">
                  {created.password ?? "-"}
                </code>
                {created.password && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={t("common.copy")}
                    onClick={() => navigator.clipboard?.writeText(created.password!).then(() => toast.success(t("common.copied")))}
                  >
                    <Copy className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => close(false)}>{t("common.done")}</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="code" label={t("companies.code")} error={errors.code?.message} hint={t("companies.codeHint")}>
                <Input id="code" {...form.register("code", { setValueAs: (v: string) => v.toUpperCase() })} />
              </Field>
              <Field id="name" label={t("companies.name")} error={errors.name?.message}>
                <Input id="name" {...form.register("name")} />
              </Field>
            </div>
            <Field id="email" label={t("companies.email")} error={errors.email?.message}>
              <Input id="email" type="email" {...form.register("email")} />
            </Field>
            <p className="text-sm font-medium">{t("companies.firstAdmin")}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="adminUsername" label={t("companies.adminUsername")} error={errors.adminUsername?.message}>
                <Input id="adminUsername" autoComplete="off" {...form.register("adminUsername")} />
              </Field>
              <Field id="adminFullName" label={t("companies.adminFullName")} error={errors.adminFullName?.message}>
                <Input id="adminFullName" {...form.register("adminFullName")} />
              </Field>
            </div>
            <Field id="adminEmail" label={t("companies.adminEmail")} error={errors.adminEmail?.message}>
              <Input id="adminEmail" type="email" {...form.register("adminEmail")} />
            </Field>
            <Controller
              control={form.control}
              name="enableLogin"
              render={({ field }) => (
                <label className="flex items-center gap-3 text-sm">
                  <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={t("companies.loginStatus")} />
                  {t("companies.enableLogin")}
                </label>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => close(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("common.saving") : t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** PUT /iam/companies/{id}: name and email (full replacement; the code is fixed). */
export function EditCompanyDialog({
  company,
  onOpenChange,
  onSaved,
}: {
  company?: CompanyDto
  onOpenChange: (o: boolean) => void
  onSaved: () => void
}) {
  const t = useT()
  const form = useForm<TCompanyUpdateSchema>({
    resolver: zodResolver(getCompanyUpdateSchema(t)),
    mode: "all",
    values: { name: company?.name ?? "", email: company?.email ?? "" },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(v: TCompanyUpdateSchema) {
    if (!company?.id) return
    try {
      await CompanyService.update(company.id, v)
      toast.success(t("common.saved"))
      onSaved()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Dialog open={!!company} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("companies.edit")}</DialogTitle>
          <DialogDescription>
            {t("companies.code")}: {company?.code ?? "-"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <Field id="edit-name" label={t("companies.name")} error={errors.name?.message}>
            <Input id="edit-name" {...form.register("name")} />
          </Field>
          <Field id="edit-email" label={t("companies.email")} error={errors.email?.message}>
            <Input id="edit-email" type="email" {...form.register("email")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** POST /iam/companies/{id}/reset-password: permanent password for the first active COMPANY_ADMIN; ends its sessions. */
export function CompanyPasswordDialog({
  company,
  onOpenChange,
}: {
  company?: CompanyDto
  onOpenChange: (o: boolean) => void
}) {
  const t = useT()
  const form = useForm<TCompanyPasswordSchema>({
    resolver: zodResolver(getCompanyPasswordSchema(t)),
    mode: "all",
    defaultValues: { newPassword: "", confirmPassword: "" },
  })
  const { errors, isSubmitting } = form.formState

  function close(o: boolean) {
    if (!o) form.reset()
    onOpenChange(o)
  }

  async function onSubmit(v: TCompanyPasswordSchema) {
    if (!company?.id) return
    try {
      const user = await CompanyService.resetPassword(company.id, v.newPassword)
      toast.success(t("companies.passwordChanged", { user: user?.username ?? company.name ?? "" }))
      close(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Dialog open={!!company} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("companies.changePassword")}</DialogTitle>
          <DialogDescription>{t("companies.changePasswordDesc", { name: company?.name ?? "-" })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <Field id="cp-new" label={t("profile.newPassword")} error={errors.newPassword?.message}>
            <PasswordInput id="cp-new" withIcon={false} autoComplete="new-password" {...form.register("newPassword")} />
          </Field>
          <Field id="cp-confirm" label={t("common.confirmPassword")} error={errors.confirmPassword?.message}>
            <PasswordInput id="cp-confirm" withIcon={false} autoComplete="new-password" {...form.register("confirmPassword")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => close(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
