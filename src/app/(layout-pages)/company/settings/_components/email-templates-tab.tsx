"use client"

import * as React from "react"
import { Eye, RotateCcw, Save } from "lucide-react"
import { toast } from "sonner"

import { FieldError } from "@/components/auth/password-input"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { CompanySettingsService as S, type EmailTemplateGroup, type EmailTemplateView } from "@/lib/company/company.service"
import { useT, type TranslationKey } from "@/lib/i18n"

const LANGS = ["vi", "en", "ko"] as const
type Lang = (typeof LANGS)[number]
type Draft = { subject: string; body: string }
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))
const placeholders = (text: string) => [...text.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1])

/**
 * Business email templates of the company (EmailNotificationTemplateController, NOTIFICATION_SETTINGS_UPDATE): emails
 * the modules send (invoices, helpdesk, CRM, recruitment…). Per language the company writes its own subject + HTML body,
 * or keeps the built-in default (whose text the API does not return). {placeholders} must be among the template's
 * variables (SETTINGS_025); values are HTML-escaped when sent.
 */
export function EmailTemplatesTab({ manage }: { manage: boolean }) {
  const t = useT()
  const [groups, setGroups] = React.useState<EmailTemplateGroup[]>()
  const [error, setError] = React.useState<string>()
  const [code, setCode] = React.useState<string>()
  const [reload, setReload] = React.useState(0)
  React.useEffect(() => {
    let cancelled = false
    S.emailTemplates()
      .then((g) => {
        if (cancelled) return
        setGroups(g ?? [])
        setCode((c) => c ?? g?.[0]?.templates?.[0]?.code)
      })
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [reload])
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  if (!groups) return <Skeleton className="h-96" />
  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>{t("etpl.title")}</CardTitle>
          <CardDescription>{t("etpl.desc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {groups.map((g) => (
            <div key={g.module} className="grid gap-1">
              <p className="text-muted-foreground text-xs font-semibold uppercase">{t(`etpl.module.${g.module}` as TranslationKey)}</p>
              {g.templates?.map((tp) => (
                <Button key={tp.code} variant={tp.code === code ? "secondary" : "ghost"} size="sm" className="h-auto justify-between py-1.5 text-left whitespace-normal" aria-current={tp.code === code ? "true" : undefined} onClick={() => setCode(tp.code)}>
                  <span>{tp.name}</span>
                  {tp.customised && (
                    <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                      {tp.customisedLanguages?.join(" ")}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
      {code && <TemplateEditor key={code} code={code} manage={manage} onChanged={() => setReload((k) => k + 1)} />}
    </div>
  )
}

function TemplateEditor({ code, manage, onChanged }: { code: string; manage: boolean; onChanged: () => void }) {
  const t = useT()
  const [view, setView] = React.useState<EmailTemplateView>()
  const [error, setError] = React.useState<string>()
  const [lang, setLang] = React.useState<Lang>("vi")
  const [drafts, setDrafts] = React.useState<Record<Lang, Draft>>()
  const [busy, setBusy] = React.useState(false)
  const [resetting, setResetting] = React.useState(false)
  const [preview, setPreview] = React.useState<{ subject?: string; body?: string }>()
  const [touched, setTouched] = React.useState(false)
  const subjectRef = React.useRef<HTMLInputElement>(null)
  const bodyRef = React.useRef<HTMLTextAreaElement>(null)
  const last = React.useRef<"subject" | "body">("body")

  const apply = (v: EmailTemplateView) => {
    setView(v)
    setDrafts(Object.fromEntries(LANGS.map((l) => {
      const c = v.languages?.find((x) => x.lang === l)
      return [l, { subject: c?.subject ?? "", body: c?.body ?? "" }]
    })) as Record<Lang, Draft>)
  }
  React.useEffect(() => {
    let cancelled = false
    S.emailTemplate(code)
      .then((v) => !cancelled && apply(v))
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [code])
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  if (!view || !drafts) return <Skeleton className="h-96" />

  const content = view.languages?.find((x) => x.lang === lang)
  const customised = !!content?.customised
  const cur = drafts[lang]
  const saved = { subject: content?.subject ?? "", body: content?.body ?? "" }
  const dirty = (l: Lang) => {
    const c = view.languages?.find((x) => x.lang === l)
    return drafts[l].subject !== (c?.subject ?? "") || drafts[l].body !== (c?.body ?? "")
  }
  const vars = view.variables ?? []
  const unknown = [...new Set([...placeholders(cur.subject), ...placeholders(cur.body)])].filter((p) => !vars.includes(p))
  const errors = {
    subject: touched && !cur.subject.trim() ? t("etpl.required") : undefined,
    body: touched && !cur.body.trim() ? t("etpl.required") : undefined,
    vars: unknown.length ? t("etpl.unknownVars", { vars: unknown.map((v) => `{${v}}`).join(", ") }) : undefined,
  }
  const setCur = (p: Partial<Draft>) => setDrafts({ ...drafts, [lang]: { ...cur, ...p } })
  const insert = (v: string) => {
    const token = `{${v}}`
    const field = last.current
    const el = field === "subject" ? subjectRef.current : bodyRef.current
    const text = cur[field]
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    setCur({ [field]: text.slice(0, start) + token + text.slice(end) })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    })
  }
  const run = async (fn: () => Promise<unknown>, ok: TranslationKey) => {
    setBusy(true)
    try {
      await fn()
      toast.success(t(ok))
      const v = await S.emailTemplate(code)
      // keep the unsaved edits of the other languages
      const keep = Object.fromEntries(LANGS.filter((l) => l !== lang && dirty(l)).map((l) => [l, drafts[l]]))
      apply(v)
      setDrafts((d) => (d ? { ...d, ...keep } : d))
      setTouched(false)
      onChanged()
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  const save = () => {
    setTouched(true)
    if (!cur.subject.trim() || !cur.body.trim() || unknown.length) return
    void run(() => S.saveEmailTemplate(code, lang, { subject: cur.subject.trim(), body: cur.body }), "etpl.saved")
  }
  const openPreview = async () => {
    setBusy(true)
    try {
      // the text being written, else the saved one (the built-in default can't be previewed: SETTINGS_023)
      setPreview(await S.previewEmailTemplate(code, lang, { subject: cur.subject || undefined, body: cur.body || undefined }))
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {view.name}
          <Badge variant="outline" className="font-mono text-xs">
            {view.code}
          </Badge>
        </CardTitle>
        <CardDescription>{t("etpl.editorHint")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Tabs value={lang} onValueChange={(v) => { setLang(v as Lang); setTouched(false) }}>
          <TabsList>
            {LANGS.map((l) => {
              const c = view.languages?.find((x) => x.lang === l)
              return (
                <TabsTrigger key={l} value={l}>
                  {t(`etpl.lang.${l}` as TranslationKey)}
                  {c?.customised && <span className="bg-primary ml-1 size-1.5 rounded-full" aria-label={t("etpl.customised")} />}
                  {dirty(l) && <span className="ml-1 text-xs">*</span>}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
        <Alert>
          <AlertDescription data-testid="etpl-state">{customised ? t("etpl.stateCustom") : t("etpl.stateDefault")}</AlertDescription>
        </Alert>
        <div className="grid gap-1.5">
          <Label htmlFor="etpl-subject">{t("etpl.subject")} *</Label>
          <Input id="etpl-subject" ref={subjectRef} maxLength={255} disabled={!manage} value={cur.subject} onFocus={() => (last.current = "subject")} onChange={(e) => setCur({ subject: e.target.value })} />
          <FieldError message={errors.subject} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="etpl-body">{t("etpl.body")} *</Label>
          <Textarea id="etpl-body" ref={bodyRef} rows={12} maxLength={60000} disabled={!manage} className="font-mono text-xs" value={cur.body} onFocus={() => (last.current = "body")} onChange={(e) => setCur({ body: e.target.value })} />
          <FieldError message={errors.body} />
        </div>
        <div className="grid gap-2">
          <span className="text-sm font-medium">{t("etpl.variables")}</span>
          <div className="flex flex-wrap gap-1.5" data-testid="etpl-variables">
            {vars.map((v) => (
              <Button key={v} type="button" size="sm" variant="outline" className="font-mono text-xs" disabled={!manage} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(v)}>
                {`{${v}}`}
              </Button>
            ))}
          </div>
          <FieldError message={errors.vars} />
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {manage && (
            <Button onClick={save} disabled={busy || !dirty(lang)}>
              <Save /> {t("etpl.save")}
            </Button>
          )}
          {manage && (
            <Button variant="outline" disabled={busy || !dirty(lang)} onClick={() => setDrafts({ ...drafts, [lang]: saved })}>
              {t("etpl.discard")}
            </Button>
          )}
          {manage && customised && (
            <Button variant="outline" disabled={busy} onClick={() => setResetting(true)}>
              <RotateCcw /> {t("etpl.reset")}
            </Button>
          )}
          <Button variant="outline" disabled={busy || (!cur.subject.trim() && !cur.body.trim())} onClick={openPreview}>
            <Eye /> {t("etpl.preview")}
          </Button>
        </div>
      </CardContent>
      <ConfirmDialog
        open={resetting}
        onOpenChange={setResetting}
        title={t("etpl.resetTitle", { lang: t(`etpl.lang.${lang}` as TranslationKey) })}
        description={t("etpl.resetDesc")}
        onConfirm={() => run(() => S.resetEmailTemplate(code, lang), "etpl.resetDone")}
      />
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(undefined)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("etpl.preview")}</DialogTitle>
            <DialogDescription data-testid="etpl-preview-subject">{preview?.subject}</DialogDescription>
          </DialogHeader>
          {/* HTML of the company: a sandbox without allow-scripts keeps it inert */}
          <iframe title={t("etpl.preview")} sandbox="" srcDoc={preview?.body ?? ""} className="h-[55vh] w-full rounded-md border bg-white" />
        </DialogContent>
      </Dialog>
    </Card>
  )
}
