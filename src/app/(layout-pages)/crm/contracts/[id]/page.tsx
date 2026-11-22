"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Paperclip, Pencil, Plus, Trash2 } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useMoney } from "@/hooks/use-money"
import { useAuthStore } from "@/lib/auth/auth.store"
import { getRenewalSchema, toNumber, type TRenewalSchema } from "@/lib/crm/crm.schema"
import {
  ContractService,
  ContractTypeService,
  type ContractDetail,
  type ContractTypeDto,
  type EContractStatus,
  type RenewalDto,
  type RenewalForm,
} from "@/lib/crm/crm.service"
import { formatDate } from "@/lib/format"
import { MediaService } from "@/lib/media/media.service"
import { SalesLookupService, type CustomerOption } from "@/lib/sales/sales.service"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { CONTRACT_STATUSES, contractBody, ContractFormDialog } from "../../_components/contract-form-dialog"
import { attempt, ContractStatusBadge, errorMessage, FormField, NameDialog } from "../../_components/crm-kit"

type Removing = { title: string; run: () => Promise<unknown> }

/**
 * §7.5 contract detail: info panel, agreement text, renewals, notes, comments, attachments.
 * TODO(assumption): signatures and the printable preview have no backend API yet; not shown.
 */
export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const t = useT()
  const money = useMoney()
  const language = useLanguageStore((s) => s.language)
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("CRM_CONTRACT_MANAGE")
  const [detail, setDetail] = React.useState<ContractDetail>()
  const [error, setError] = React.useState<string>()
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [types, setTypes] = React.useState<ContractTypeDto[]>([])
  const [customers, setCustomers] = React.useState<CustomerOption[]>([])
  const [editing, setEditing] = React.useState(false)
  const [agreement, setAgreement] = React.useState<string>()
  const [renewal, setRenewal] = React.useState<{ renewal?: RenewalDto } | null>(null)
  const [note, setNote] = React.useState<{ id?: string; note?: string } | null>(null)
  const [comment, setComment] = React.useState("")
  const [removing, setRemoving] = React.useState<Removing>()
  const [uploading, setUploading] = React.useState(false)
  const fileInput = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    let cancelled = false
    ContractService.get(id)
      .then((d) => !cancelled && (setDetail(d), setError(undefined)))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [id, reloadKey])

  React.useEffect(() => {
    let cancelled = false
    Promise.all([
      ContractTypeService.list().catch(() => []),
      SalesLookupService.customers().then((r) => r.content ?? []).catch(() => []),
    ]).then(([ty, cu]) => !cancelled && (setTypes(ty), setCustomers(cu)))
    return () => {
      cancelled = true
    }
  }, [])

  const run = async (fn: () => Promise<unknown>, done?: TranslationKey) => {
    const ok = await attempt(fn, done ? t(done) : undefined)
    if (ok) reload()
    return ok
  }

  if (error)
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  if (!detail)
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )

  const c = detail.contract ?? {}
  const text = agreement ?? detail.description ?? ""

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    try {
      const uploaded = await MediaService.upload([...files])
      for (const f of uploaded) if (f.id) await ContractService.addAttachment(id, f.id)
      toast.success(t("crm.done.fileAdded"))
      reload()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  async function openFile(mediaFileId?: string) {
    if (!mediaFileId) return
    try {
      const f = await MediaService.file(mediaFileId)
      if (f.viewUrl?.startsWith("http")) window.open(f.viewUrl, "_blank", "noopener")
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const info: { label: string; value: React.ReactNode }[] = [
    { label: t("crm.contract.number"), value: <span className="font-mono">{c.number ?? "-"}</span> },
    { label: t("crm.client"), value: c.customerName ?? "-" },
    { label: t("crm.contract.type"), value: detail.contractTypeName ?? "-" },
    { label: t("crm.value"), value: c.value === null || c.value === undefined ? "-" : money(c.value) },
    { label: t("crm.startDate"), value: formatDate(c.startDate, language) },
    { label: t("crm.endDate"), value: formatDate(c.endDate, language) },
    { label: t("crm.status"), value: <ContractStatusBadge status={c.status} /> },
  ]

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/crm/contracts">
            <ArrowLeft className="size-4" /> {t("menu.crm.contracts")}
          </Link>
        </Button>
      </div>
      <PageHeader title={c.subject ?? "-"} description={c.number}>
        {manage && (
          <>
            <Select value={c.status ?? ""} onValueChange={(s) => run(() => ContractService.status(id, s as EContractStatus), "common.saved")}>
              <SelectTrigger className="w-36" aria-label={t("crm.status")}>
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
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> {t("common.edit")}
            </Button>
          </>
        )}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("crm.contract.agreement")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {manage ? (
                <>
                  <Textarea rows={10} value={text} onChange={(e) => setAgreement(e.target.value)} aria-label={t("crm.contract.agreement")} />
                  <div>
                    <Button
                      size="sm"
                      disabled={agreement === undefined || agreement === (detail.description ?? "")}
                      onClick={async () => {
                        if (await run(() => ContractService.update(id, contractBody(detail, { description: text || null })), "common.saved"))
                          setAgreement(undefined)
                      }}
                    >
                      {t("common.save")}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{detail.description || t("crm.noEntries")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t("crm.contract.renewals")}</CardTitle>
              {manage && (
                <Button variant="outline" size="sm" onClick={() => setRenewal({})}>
                  <Plus className="size-4" /> {t("crm.renewal.create")}
                </Button>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("crm.startDate")}</TableHead>
                    <TableHead>{t("crm.endDate")}</TableHead>
                    <TableHead className="text-right">{t("crm.value")}</TableHead>
                    <TableHead>{t("crm.status")}</TableHead>
                    <TableHead>{t("crm.notes")}</TableHead>
                    <TableHead className="w-24">
                      <span className="sr-only">{t("common.actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(detail.renewals ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground h-16 text-center">
                        {t("crm.noEntries")}
                      </TableCell>
                    </TableRow>
                  )}
                  {(detail.renewals ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{formatDate(r.startDate, language)}</TableCell>
                      <TableCell>{formatDate(r.endDate, language)}</TableCell>
                      <TableCell className="text-right">{money(r.value)}</TableCell>
                      <TableCell>
                        <ContractStatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="max-w-48 truncate">{r.notes || "-"}</TableCell>
                      <TableCell>
                        {manage && (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label={t("crm.editNamed", { name: formatDate(r.startDate, language) })}
                              onClick={() => setRenewal({ renewal: r })}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label={t("crm.deleteNamed", { name: formatDate(r.startDate, language) })}
                              onClick={() => setRemoving({ title: t("crm.confirm.deleteRenewal"), run: () => ContractService.removeRenewal(id, r.id!) })}
                            >
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
              <CardTitle className="text-base">{t("crm.contract.comments")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <form
                className="flex flex-col gap-2"
                onSubmit={async (e) => {
                  e.preventDefault()
                  const m = comment.trim()
                  if (!m) return
                  if (m.length > 5000) return toast.error(t("crm.v.max", { n: 5000 }))
                  if (await run(() => ContractService.addComment(id, m))) setComment("")
                }}
              >
                <Textarea
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t("crm.discussion.placeholder")}
                  aria-label={t("crm.contract.comments")}
                />
                <div>
                  <Button type="submit" size="sm" disabled={!comment.trim()}>
                    {t("crm.discussion.add")}
                  </Button>
                </div>
              </form>
              {(detail.comments ?? []).length === 0 && <p className="text-muted-foreground text-sm">{t("crm.noEntries")}</p>}
              <ul className="flex flex-col gap-2">
                {(detail.comments ?? []).map((m) => (
                  <li key={m.id} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                    <div className="flex-1">
                      <p className="whitespace-pre-wrap">{m.message}</p>
                      <div className="text-muted-foreground mt-1 text-xs">
                        {m.authorName ? `${m.authorName} · ` : ""}
                        {formatDate(m.createdDate, language, true)}
                      </div>
                    </div>
                    {manage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={t("crm.deleteNamed", { name: t("crm.entry") })}
                        onClick={() => setRemoving({ title: t("crm.confirm.deleteEntry"), run: () => ContractService.removeComment(id, m.id!) })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("crm.info")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <dl className="grid gap-2 text-sm">
                {info.map((f) => (
                  <div key={f.label} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="text-right">{f.value}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <Progress value={c.progressPercent ?? 0} className="h-1.5" aria-label={t("crm.contract.duration")} />
                <div className="text-muted-foreground mt-1 text-xs">
                  {(c.daysLeft ?? 0) > 0 ? t("crm.contract.daysLeft", { n: c.daysLeft ?? 0 }) : t("crm.contract.ended")}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t("crm.contract.attachments")}</CardTitle>
              {manage && (
                <>
                  <input ref={fileInput} type="file" multiple hidden onChange={(e) => upload(e.target.files)} aria-label={t("crm.file.upload")} />
                  <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
                    <Paperclip className="size-4" /> {t("crm.file.upload")}
                  </Button>
                </>
              )}
            </CardHeader>
            <CardContent>
              {(detail.attachments ?? []).length === 0 && <p className="text-muted-foreground text-sm">{t("crm.noEntries")}</p>}
              <ul className="flex flex-col gap-2">
                {(detail.attachments ?? []).map((f) => (
                  <li key={f.id} className="flex items-center gap-2 text-sm">
                    <Paperclip className="text-muted-foreground size-4" />
                    <button type="button" className="flex-1 truncate text-left hover:underline" onClick={() => openFile(f.mediaFileId)}>
                      {f.fileName ?? `#${f.mediaFileId}`}
                    </button>
                    {manage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={t("crm.deleteNamed", { name: f.fileName ?? "" })}
                        onClick={() => setRemoving({ title: t("crm.confirm.deleteEntry"), run: () => ContractService.removeAttachment(id, f.id!) })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t("crm.notes")}</CardTitle>
              {manage && (
                <Button variant="outline" size="sm" onClick={() => setNote({})}>
                  <Plus className="size-4" /> {t("crm.note.create")}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {(detail.notes ?? []).length === 0 && <p className="text-muted-foreground text-sm">{t("crm.noEntries")}</p>}
              <ul className="flex flex-col gap-2">
                {(detail.notes ?? []).map((n) => (
                  <li key={n.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                    <div className="flex-1">
                      <p className="whitespace-pre-wrap">{n.note}</p>
                      <div className="text-muted-foreground mt-1 text-xs">{formatDate(n.updatedDate ?? n.createdDate, language, true)}</div>
                    </div>
                    {manage && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={t("crm.editNamed", { name: t("crm.note") })}
                          onClick={() => setNote({ id: n.id, note: n.note })}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={t("crm.deleteNamed", { name: t("crm.note") })}
                          onClick={() => setRemoving({ title: t("crm.confirm.deleteEntry"), run: () => ContractService.removeNote(id, n.id!) })}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <ContractFormDialog
        state={editing ? { detail } : null}
        customers={customers}
        types={types}
        onClose={() => setEditing(false)}
        onSaved={reload}
      />
      <RenewalDialog
        state={renewal}
        onClose={() => setRenewal(null)}
        onSave={(body, rid) => run(() => (rid ? ContractService.updateRenewal(id, rid, body) : ContractService.addRenewal(id, body)), "common.saved")}
      />
      <NameDialog
        open={!!note}
        title={t(note?.id ? "crm.note.edit" : "crm.note.create")}
        label={t("crm.note")}
        initial={note?.note}
        maxLength={5000}
        onClose={() => setNote(null)}
        onSave={(text) => run(() => (note?.id ? ContractService.updateNote(id, note.id, text) : ContractService.addNote(id, text)), "common.saved")}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(undefined)}
        title={removing?.title ?? ""}
        description={t("crm.confirm.deleteDesc")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (removing) await run(removing.run, "crm.done.deleted")
        }}
      />
    </div>
  )
}

function RenewalDialog({
  state,
  onClose,
  onSave,
}: {
  state: { renewal?: RenewalDto } | null
  onClose: () => void
  onSave: (body: RenewalForm, id?: string) => Promise<boolean>
}) {
  const t = useT()
  const values = React.useMemo<TRenewalSchema>(
    () => ({
      startDate: state?.renewal?.startDate ?? "",
      endDate: state?.renewal?.endDate ?? "",
      value: state?.renewal?.value === undefined ? "" : String(state.renewal.value),
      status: state?.renewal?.status ?? "PENDING",
      notes: state?.renewal?.notes ?? "",
    }),
    [state]
  )
  const form = useForm<TRenewalSchema>({ resolver: zodResolver(getRenewalSchema(t)), mode: "all", values })
  const { errors, isSubmitting } = form.formState
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          noValidate
          onSubmit={form.handleSubmit(async (v) => {
            const ok = await onSave(
              { startDate: v.startDate, endDate: v.endDate, value: toNumber(v.value), status: v.status, notes: v.notes.trim() || null },
              state?.renewal?.id
            )
            if (ok) onClose()
          })}
        >
          <DialogHeader>
            <DialogTitle>{t(state?.renewal ? "crm.renewal.edit" : "crm.renewal.create")}</DialogTitle>
            <DialogDescription className="sr-only">{t("crm.contract.renewals")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <FormField id="rn-start" label={t("crm.startDate")} error={errors.startDate?.message}>
              <Input id="rn-start" type="date" {...form.register("startDate")} />
            </FormField>
            <FormField id="rn-end" label={t("crm.endDate")} error={errors.endDate?.message}>
              <Input id="rn-end" type="date" {...form.register("endDate")} />
            </FormField>
            <FormField id="rn-value" label={t("crm.value")} error={errors.value?.message}>
              <Input id="rn-value" inputMode="decimal" {...form.register("value")} />
            </FormField>
            <FormField id="rn-status" label={t("crm.status")}>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="rn-status" className="w-full" aria-label={t("crm.status")}>
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
          </div>
          <FormField id="rn-notes" label={t("crm.notes")} error={errors.notes?.message}>
            <Textarea id="rn-notes" rows={2} {...form.register("notes")} />
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
