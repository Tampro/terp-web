"use client"

import * as React from "react"
import Link from "next/link"
import { Eye, RotateCcw, Save } from "lucide-react"
import { toast } from "sonner"

import { FieldError } from "@/components/auth/password-input"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { CHAT_CHANNELS, CompanySettingsService as S, type ChatChannel, type ChatTemplatesView, type ChatTemplateView } from "@/lib/company/company.service"
import { useT, type TranslationKey } from "@/lib/i18n"

const LANGS = ["vi", "en", "ko"] as const
type Lang = (typeof LANGS)[number]
/** ChatTemplateForm: at most 1000 characters for Slack / Telegram, 1600 for SMS (SETTINGS_024) */
const MAX: Record<ChatChannel, number> = { slack: 1000, telegram: 1000, sms: 1600 }
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))
const placeholders = (text: string) => [...text.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1])

/**
 * Notification templates (manual §3.5: Slack, Telegram, Twilio SMS), ChatNotificationTemplateController
 * /v1/settings/notification-templates/{channel} (IAM_SETTINGS_MANAGE): the events a channel sends, grouped by module;
 * per language the company's own plain text or the built-in default. A channel whose integration is not configured is
 * read-only (saving is refused, SETTINGS_022; resetting is allowed).
 */
export function ChatTemplatesTab({ manage }: { manage: boolean }) {
  const t = useT()
  const [channel, setChannel] = React.useState<ChatChannel>("slack")
  const [data, setData] = React.useState<{ channel: ChatChannel; view?: ChatTemplatesView; error?: string }>()
  const [event, setEvent] = React.useState<string>()
  const [reload, setReload] = React.useState(0)
  React.useEffect(() => {
    let cancelled = false
    S.chatTemplates(channel)
      .then((view) => {
        if (cancelled) return
        setData({ channel, view })
        setEvent((e) => (view.modules?.some((m) => m.events?.some((x) => x.eventType === e)) ? e : view.modules?.[0]?.events?.[0]?.eventType))
      })
      .catch((e) => !cancelled && setData({ channel, error: errorText(e) }))
    return () => {
      cancelled = true
    }
  }, [channel, reload])
  const current = data?.channel === channel ? data : undefined
  const configured = !!current?.view?.configured
  return (
    <div className="grid gap-4">
      <Tabs value={channel} onValueChange={(v) => setChannel(v as ChatChannel)}>
        <TabsList>
          {CHAT_CHANNELS.map((c) => (
            <TabsTrigger key={c} value={c}>
              {t(`ctpl.channel.${c}` as TranslationKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {current?.error && (
        <Alert variant="destructive">
          <AlertDescription>{current.error}</AlertDescription>
        </Alert>
      )}
      {!current && <Skeleton className="h-96" />}
      {current?.view && (
        <>
          {!configured && (
            <Alert data-testid="ctpl-not-configured">
              <AlertDescription>
                {t("ctpl.notConfigured", { channel: t(`ctpl.channel.${channel}` as TranslationKey) })}{" "}
                <Link href="/company/settings?tab=integrations" className="text-primary underline">
                  {t("ctpl.openIntegrations")}
                </Link>
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>{t("ctpl.events")}</CardTitle>
                <CardDescription>{t("ctpl.eventsDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {current.view.modules?.map((m) => (
                  <div key={m.module} className="grid gap-1">
                    <p className="text-muted-foreground text-xs font-semibold uppercase">{t(`ctpl.module.${m.module}` as TranslationKey)}</p>
                    {m.events?.map((e) => (
                      <Button key={e.eventType} variant={e.eventType === event ? "secondary" : "ghost"} size="sm" className="h-auto justify-between py-1.5 text-left whitespace-normal" aria-current={e.eventType === event ? "true" : undefined} onClick={() => setEvent(e.eventType)}>
                        <span>{e.name}</span>
                        {!!e.customisedLanguages?.length && (
                          <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                            {e.customisedLanguages.join(" ")}
                          </Badge>
                        )}
                      </Button>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
            {event && <ChatEditor key={`${channel}:${event}`} channel={channel} eventType={event} manage={manage} configured={configured} onChanged={() => setReload((k) => k + 1)} />}
          </div>
        </>
      )}
    </div>
  )
}

function ChatEditor({ channel, eventType, manage, configured, onChanged }: { channel: ChatChannel; eventType: string; manage: boolean; configured: boolean; onChanged: () => void }) {
  const t = useT()
  const [view, setView] = React.useState<ChatTemplateView>()
  const [error, setError] = React.useState<string>()
  const [lang, setLang] = React.useState<Lang>("vi")
  const [drafts, setDrafts] = React.useState<Record<Lang, string>>()
  const [busy, setBusy] = React.useState(false)
  const [resetting, setResetting] = React.useState(false)
  const [preview, setPreview] = React.useState<string>()
  const [touched, setTouched] = React.useState(false)
  const ref = React.useRef<HTMLTextAreaElement>(null)
  const apply = (v: ChatTemplateView) => {
    setView(v)
    setDrafts(Object.fromEntries(LANGS.map((l) => [l, v.languages?.find((x) => x.lang === l)?.text ?? ""])) as Record<Lang, string>)
  }
  React.useEffect(() => {
    let cancelled = false
    S.chatTemplate(channel, eventType)
      .then((v) => !cancelled && apply(v))
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [channel, eventType])
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  if (!view || !drafts) return <Skeleton className="h-80" />

  const content = view.languages?.find((x) => x.lang === lang)
  const customised = !!content?.customised
  const text = drafts[lang]
  const max = MAX[channel]
  const dirty = (l: Lang) => drafts[l] !== (view.languages?.find((x) => x.lang === l)?.text ?? "")
  const vars = view.variables ?? []
  const unknown = [...new Set(placeholders(text))].filter((p) => !vars.includes(p))
  const canEdit = manage && configured
  const errors = {
    text: touched && !text.trim() ? t("ctpl.required") : text.length > max ? t("ctpl.tooLong", { n: max }) : undefined,
    vars: unknown.length ? t("ctpl.unknownVars", { vars: unknown.map((v) => `{${v}}`).join(", ") }) : undefined,
  }
  const insert = (v: string) => {
    const token = `{${v}}`
    const el = ref.current
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    setDrafts({ ...drafts, [lang]: text.slice(0, start) + token + text.slice(end) })
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
      const keep = Object.fromEntries(LANGS.filter((l) => l !== lang && dirty(l)).map((l) => [l, drafts[l]]))
      apply(await S.chatTemplate(channel, eventType))
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
    if (!text.trim() || text.length > max || unknown.length) return
    void run(() => S.saveChatTemplate(channel, eventType, lang, text), "ctpl.saved")
  }
  const openPreview = async () => {
    setBusy(true)
    try {
      setPreview((await S.previewChatTemplate(channel, eventType, lang, text || undefined))?.text ?? "")
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
            {view.eventType}
          </Badge>
        </CardTitle>
        <CardDescription>{t("ctpl.editorHint")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Tabs value={lang} onValueChange={(v) => { setLang(v as Lang); setTouched(false); setPreview(undefined) }}>
          <TabsList>
            {LANGS.map((l) => (
              <TabsTrigger key={l} value={l}>
                {t(`etpl.lang.${l}` as TranslationKey)}
                {view.languages?.find((x) => x.lang === l)?.customised && <span className="bg-primary ml-1 size-1.5 rounded-full" aria-label={t("etpl.customised")} />}
                {dirty(l) && <span className="ml-1 text-xs">*</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Alert>
          <AlertDescription data-testid="ctpl-state">{customised ? t("etpl.stateCustom") : t("ctpl.stateDefault")}</AlertDescription>
        </Alert>
        <div className="grid gap-1.5">
          <Label htmlFor="ctpl-text">{t("ctpl.text")} *</Label>
          <Textarea id="ctpl-text" ref={ref} rows={6} disabled={!canEdit} value={text} onChange={(e) => setDrafts({ ...drafts, [lang]: e.target.value })} aria-invalid={!!errors.text} />
          <div className="flex justify-between gap-2">
            <FieldError message={errors.text} />
            <span className={`ml-auto text-xs ${text.length > max ? "text-destructive" : "text-muted-foreground"}`} data-testid="ctpl-count">
              {text.length} / {max}
            </span>
          </div>
        </div>
        <div className="grid gap-2">
          <span className="text-sm font-medium">{t("etpl.variables")}</span>
          <div className="flex flex-wrap gap-1.5" data-testid="ctpl-variables">
            {vars.map((v) => (
              <Button key={v} type="button" size="sm" variant="outline" className="font-mono text-xs" disabled={!canEdit} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(v)}>
                {`{${v}}`}
              </Button>
            ))}
          </div>
          <FieldError message={errors.vars} />
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {canEdit && (
            <Button onClick={save} disabled={busy || !dirty(lang)}>
              <Save /> {t("etpl.save")}
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" disabled={busy || !dirty(lang)} onClick={() => setDrafts({ ...drafts, [lang]: content?.text ?? "" })}>
              {t("etpl.discard")}
            </Button>
          )}
          {/* resetting is allowed even while the integration is not configured */}
          {manage && customised && (
            <Button variant="outline" disabled={busy} onClick={() => setResetting(true)}>
              <RotateCcw /> {t("etpl.reset")}
            </Button>
          )}
          <Button variant="outline" disabled={busy || !text.trim()} onClick={openPreview}>
            <Eye /> {t("etpl.preview")}
          </Button>
        </div>
        {preview !== undefined && (
          <div className="grid gap-1">
            <span className="text-sm font-medium">{t("etpl.preview")}</span>
            {/* plain text: shown as text, never as HTML */}
            <pre className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap" data-testid="ctpl-preview">
              {preview}
            </pre>
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={resetting}
        onOpenChange={setResetting}
        title={t("etpl.resetTitle", { lang: t(`etpl.lang.${lang}` as TranslationKey) })}
        description={t("etpl.resetDesc")}
        onConfirm={() => run(() => S.resetChatTemplate(channel, eventType, lang), "etpl.resetDone")}
      />
    </Card>
  )
}
