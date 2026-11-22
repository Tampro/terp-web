"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, ArrowRightLeft, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { CONVERT_FIELDS, FormService, type EConvertTarget, type FieldDto, type FormDto, type ResponseDto } from "@/lib/project/project.service"

import { attempt } from "../../projects/_components/project-kit"

const PAGE_SIZE = 20
const TARGETS: EConvertTarget[] = ["LEAD", "DEAL", "PROJECT", "CONTRACT"]
const FIXED = "__fixed"
const SKIP = "__skip"
const show = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v === null || v === undefined || v === "" ? "-" : String(v))

export default function FormResponsesPage() {
  return (
    <React.Suspense>
      <FormResponses />
    </React.Suspense>
  )
}

/** §11.2 responses of a form with a date filter; Convert maps fields to a Project, Contract, CRM Lead or CRM Deal (once, FRM_015). */
function FormResponses() {
  const { id } = useParams<{ id: string }>()
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("FORM_MANAGE")
  const { searchParams, update } = useUrlQuery()
  const from = searchParams.get("from") ?? undefined
  const to = searchParams.get("to") ?? undefined
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const [form, setForm] = React.useState<FormDto>()
  const [error, setError] = React.useState<string>()
  const [data, setData] = React.useState<IPage<ResponseDto>>()
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [converting, setConverting] = React.useState<ResponseDto>()
  const [deleting, setDeleting] = React.useState<ResponseDto>()

  React.useEffect(() => {
    let cancelled = false
    FormService.get(id)
      .then((f) => !cancelled && setForm(f))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [id])

  React.useEffect(() => {
    let cancelled = false
    FormService.responses(id, { from, to, page, size: PAGE_SIZE })
      .then((p) => !cancelled && setData(p))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [id, from, to, page, reloadKey])

  if (error)
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  const fields = form?.fields ?? []
  const rows = data?.content ?? []
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/forms">
            <ArrowLeft className="size-4" /> {t("menu.forms")}
          </Link>
        </Button>
      </div>
      <PageHeader title={form?.form?.name ?? "…"} description={t("form.responsesSubtitle")}>
        <Input type="date" className="w-40" aria-label={t("sales.from")} value={from ?? ""} onChange={(e) => update({ from: e.target.value, page: 0 })} />
        <Input type="date" className="w-40" aria-label={t("sales.to")} value={to ?? ""} onChange={(e) => update({ to: e.target.value, page: 0 })} />
      </PageHeader>
      {!data ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center">{t("form.noResponses")}</CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Card>
                <CardContent className="grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-muted-foreground text-xs">{formatDate(r.createdDate, language, true)}</span>
                    <div className="flex items-center gap-2">
                      {r.convertedTargetType ? (
                        <Badge variant="secondary">{t("form.convertedTo", { target: t(`form.target.${r.convertedTargetType}` as TranslationKey), id: r.convertedTargetId ?? "" })}</Badge>
                      ) : (
                        manage && (
                          <Button size="sm" variant="outline" onClick={() => setConverting(r)}>
                            <ArrowRightLeft className="size-4" /> {t("form.convert")}
                          </Button>
                        )
                      )}
                      {manage && (
                        <Button variant="ghost" size="icon" className="size-8" aria-label={t("form.deleteResponse")} onClick={() => setDeleting(r)}>
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    {(r.answers ?? []).map((a) => (
                      <div key={a.key}>
                        <dt className="text-muted-foreground text-xs">{a.label}</dt>
                        <dd className="break-words">{show(a.value)}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Pager page={data?.page ?? page} size={data?.size ?? PAGE_SIZE} total={data?.totalElements ?? 0} totalPages={data?.totalPages ?? 0} onPage={(p) => update({ page: p })} />

      <Dialog open={!!converting} onOpenChange={(o) => !o && setConverting(undefined)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
          {converting && <ConvertForm formId={id} response={converting} fields={fields} onClose={() => setConverting(undefined)} onDone={reload} />}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("form.deleteResponse")}
        description={t("crm.confirm.deleteDesc")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (deleting && (await attempt(() => FormService.removeResponse(id, deleting.id!), t("crm.done.deleted")))) reload()
        }}
      />
    </div>
  )
}

/** Each target field takes a form field or a fixed value (ids, yyyy-MM-dd dates, comma-separated id lists). */
function ConvertForm({ formId, response, fields, onClose, onDone }: { formId: string; response: ResponseDto; fields: FieldDto[]; onClose: () => void; onDone: () => void }) {
  const t = useT()
  const [target, setTarget] = React.useState<EConvertTarget>("LEAD")
  const [source, setSource] = React.useState<Record<string, string>>({})
  const [fixed, setFixed] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const [missing, setMissing] = React.useState<string[]>([])
  const targetFields = CONVERT_FIELDS[target]

  async function submit() {
    const mapping: Record<string, string> = {}
    const values: Record<string, string> = {}
    for (const f of targetFields) {
      const s = source[f.key] ?? SKIP
      if (s === FIXED) {
        if (fixed[f.key]?.trim()) values[f.key] = fixed[f.key].trim()
      } else if (s !== SKIP) mapping[f.key] = s
    }
    const miss = targetFields.filter((f) => f.required && !mapping[f.key] && !values[f.key]).map((f) => f.key)
    setMissing(miss)
    if (miss.length) return // FRM_017
    setBusy(true)
    const ok = await attempt(() => FormService.convert(formId, response.id!, { target, mapping, values }), t("form.done.converted"))
    setBusy(false)
    if (ok) {
      onDone()
      onClose()
    }
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("form.convert")}</DialogTitle>
        <DialogDescription>{t("form.convertDesc")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="cv-target">{t("form.target.label")}</Label>
        <Select
          value={target}
          onValueChange={(v) => {
            setTarget(v as EConvertTarget)
            setSource({})
            setFixed({})
            setMissing([])
          }}
        >
          <SelectTrigger id="cv-target" className="w-full" aria-label={t("form.target.label")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TARGETS.map((x) => (
              <SelectItem key={x} value={x}>
                {t(`form.target.${x}` as TranslationKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3">
        {targetFields.map((f) => {
          const s = source[f.key] ?? SKIP
          return (
            <div key={f.key} className="grid items-start gap-2 sm:grid-cols-[9rem_1fr_1fr]">
              <Label className="pt-2 font-mono text-xs">
                {f.key}
                {f.required && <span className="text-destructive"> *</span>}
              </Label>
              <Select value={s} onValueChange={(v) => setSource((x) => ({ ...x, [f.key]: v }))}>
                <SelectTrigger className="w-full" aria-label={t("form.sourceOf", { field: f.key })}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SKIP}>{t("form.skip")}</SelectItem>
                  <SelectItem value={FIXED}>{t("form.fixedValue")}</SelectItem>
                  {fields.map((ff) => (
                    <SelectItem key={ff.key} value={ff.key ?? ""}>
                      {t("form.fromField", { label: ff.label ?? ff.key ?? "" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {s === FIXED ? (
                <Input value={fixed[f.key] ?? ""} aria-label={t("form.valueOf", { field: f.key })} onChange={(e) => setFixed((x) => ({ ...x, [f.key]: e.target.value }))} />
              ) : (
                <span className="text-muted-foreground truncate pt-2 text-xs">{show(response.answers?.find((a) => a.key === s)?.value)}</span>
              )}
              {missing.includes(f.key) && <p className="text-destructive text-xs sm:col-span-3">{t("form.v.targetRequired", { field: f.key })}</p>}
            </div>
          )
        })}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button type="button" disabled={busy} onClick={submit}>
          {t("form.convert")}
        </Button>
      </DialogFooter>
    </div>
  )
}
