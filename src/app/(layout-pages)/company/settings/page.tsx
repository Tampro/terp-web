"use client"

import * as React from "react"
import { Send, Zap } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { CompanySettingsService as S, type EIntegration, type Integrations, type NotificationGroup } from "@/lib/company/company.service"
import type { Row } from "@/lib/hrm/hrm.service"
import { useT, type TranslationKey } from "@/lib/i18n"

import { attempt, CrudSection, errorMessage, fieldErrors, FormFields, initialValues, TabbedPage, toBody, useAuthStore, type CrudConfig, type FieldDef, type Values } from "../../hrm/_components/crud-kit"

const url = /^https?:\/\/\S+$/
const opts = (t: (k: TranslationKey) => string, prefix: string, list: readonly string[]) => list.map((x) => ({ value: x, label: t(`${prefix}.${x}` as TranslationKey) }))
const raw = (list: readonly string[]) => list.map((x) => ({ value: x, label: x }))

export default function CompanySettingsPage() {
  return (
    <React.Suspense>
      <CompanySettings />
    </React.Suspense>
  )
}

/** §19 company settings: profile, system, brand, currency, email (own SMTP or the platform's), email notifications, integrations, webhooks. */
function CompanySettings() {
  const t = useT()
  const perms = useAuthStore((s) => s.me?.permissions) ?? []
  const manage = perms.includes("IAM_SETTINGS_MANAGE")
  const notif = perms.includes("NOTIFICATION_SETTINGS_UPDATE")
  const profile: FieldDef[] = [
    { name: "name", label: "co.f.companyName", max: 255 },
    { name: "registrationNumber", label: "co.f.registrationNumber", max: 100 },
    { name: "email", label: "hr.f.email", type: "email", max: 255, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMsg: "hr.v.email" },
    { name: "phone", label: "hr.f.phone", max: 30, pattern: /^[0-9+()\-. ]{3,30}$/, patternMsg: "hr.v.format" },
    { name: "senderName", label: "co.f.senderName", max: 255 },
    { name: "address", label: "hr.f.address", max: 500, full: true },
    { name: "city", label: "hr.f.city", max: 100 },
    { name: "state", label: "hr.f.state", max: 100 },
    { name: "country", label: "hr.f.country", max: 100 },
    { name: "zipCode", label: "hr.f.postalCode", max: 20 },
    { name: "taxNumberEnabled", label: "co.f.taxNumberEnabled", type: "switch" },
    { name: "taxType", label: "co.f.taxType", type: "select", options: raw(["VAT", "GST"]), hidden: (v) => !v.taxNumberEnabled },
    { name: "taxNumber", label: "co.f.taxNumber", max: 100, hidden: (v) => !v.taxNumberEnabled },
  ]
  const system: FieldDef[] = [
    { name: "defaultLanguage", label: "co.f.language", type: "select", none: true, options: [{ value: "vi", label: "Tiếng Việt" }, { value: "en", label: "English" }, { value: "ko", label: "한국어" }] },
    { name: "defaultTimezone", label: "co.f.timezone", max: 60 },
    { name: "dateFormat", label: "co.f.dateFormat", type: "select", none: true, options: raw(["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "dd-MM-yyyy", "dd.MM.yyyy"]) },
    { name: "timeFormat", label: "co.f.timeFormat", type: "select", none: true, options: raw(["HH:mm", "hh:mm a", "HH:mm:ss"]) },
    { name: "calendarStartDay", label: "co.f.calendarStartDay", type: "select", none: true, options: opts(t, "hr.weekday", ["MONDAY", "SUNDAY", "SATURDAY"]) },
  ]
  const brand: FieldDef[] = [
    { name: "titleText", label: "co.f.titleText", max: 100 },
    { name: "footerText", label: "co.f.footerText", max: 255 },
    { name: "logoLightUrl", label: "co.f.logoLight", max: 1000, pattern: url, patternMsg: "tr.v.url" },
    { name: "logoDarkUrl", label: "co.f.logoDark", max: 1000, pattern: url, patternMsg: "tr.v.url" },
    { name: "faviconUrl", label: "co.f.favicon", max: 1000, pattern: url, patternMsg: "tr.v.url" },
    { name: "themeColor", label: "co.f.themeColor", type: "select", none: true, options: opts(t, "co.color", ["blue", "green", "purple", "orange", "red", "teal"]) },
    { name: "themeMode", label: "co.f.themeMode", type: "select", none: true, options: opts(t, "co.mode", ["LIGHT", "DARK", "SYSTEM"]) },
    { name: "sidebarVariant", label: "co.f.sidebarVariant", type: "select", none: true, options: raw(["INSET", "FLOATING", "MINIMAL"]) },
    { name: "sidebarStyle", label: "co.f.sidebarStyle", type: "select", none: true, options: raw(["PLAIN", "COLORED", "GRADIENT"]) },
    { name: "layoutDirection", label: "co.f.layoutDirection", type: "select", none: true, options: raw(["LTR", "RTL"]) },
    { name: "companyMobile", label: "co.f.companyMobile", max: 30, pattern: /^[0-9+()\-. ]{3,30}$/, patternMsg: "hr.v.format" },
    { name: "companyAddress", label: "co.f.companyAddress", max: 500, full: true },
  ]
  const sep = opts(t, "co.sep", ["DOT", "COMMA", "SPACE", "NONE"])
  const currency: FieldDef[] = [
    { name: "currencyCode", label: "co.f.currencyCode", max: 10, pattern: /^[A-Z]{3}$/, patternMsg: "co.v.currency" },
    { name: "decimalPlaces", label: "co.f.decimalPlaces", type: "number", min: 0, max: 4, check: (v) => (v.decimalPlaces && !Number.isInteger(Number(v.decimalPlaces)) ? "hr.v.integer" : undefined) },
    { name: "symbolPosition", label: "co.f.symbolPosition", type: "select", none: true, options: opts(t, "co.pos", ["BEFORE", "AFTER"]) },
    { name: "decimalSeparator", label: "co.f.decimalSeparator", type: "select", none: true, options: sep },
    { name: "thousandsSeparator", label: "co.f.thousandsSeparator", type: "select", none: true, options: sep, check: (v) => (v.thousandsSeparator && v.thousandsSeparator !== "NONE" && v.thousandsSeparator === v.decimalSeparator ? "co.v.separators" : undefined) },
    { name: "showDecimals", label: "co.f.showDecimals", type: "switch" },
    { name: "addSpace", label: "co.f.addSpace", type: "switch" },
  ]
  return (
    <TabbedPage
      title={t("menu.co.settings")}
      description={t("co.settings.subtitle")}
      tabs={[
        { key: "profile", label: "co.tab.profile", content: () => <Block title="co.tab.profile" hint="co.profile.hint" fields={profile} load={S.profile} save={S.saveProfile} manage={manage} /> },
        { key: "system", label: "co.tab.system", content: () => <Block title="co.tab.system" hint="co.inherit.hint" fields={system} load={S.system} save={S.saveSystem} manage={manage} /> },
        { key: "brand", label: "co.tab.brand", content: () => <Block title="co.tab.brand" hint="co.inherit.hint" fields={brand} load={S.brand} save={S.saveBrand} manage={manage} /> },
        { key: "currency", label: "co.tab.currency", content: () => <Block title="co.tab.currency" hint="co.inherit.hint" fields={currency} load={S.currency} save={S.saveCurrency} manage={manage} /> },
        { key: "email", label: "co.tab.email", content: () => <EmailBlock manage={manage} /> },
        { key: "notifications", label: "co.tab.notifications", content: () => <Notifications manage={notif} /> },
        { key: "integrations", label: "co.tab.integrations", content: () => <IntegrationsTab manage={manage} /> },
        { key: "webhooks", label: "co.tab.webhooks", content: () => <Webhooks manage={manage} /> },
      ]}
    />
  )
}

/** One settings form: GET → values, PUT the whole block (empty = use the platform value). */
function Block<T extends object>({ title, hint, fields, load, save, manage, extraBody }: { title: TranslationKey; hint?: TranslationKey; fields: FieldDef[]; load: () => Promise<T>; save: (b: T) => Promise<unknown>; manage: boolean; extraBody?: (v: Values) => object }) {
  const t = useT()
  const [values, setValues] = React.useState<Values>()
  const [key, setKey] = React.useState(0)
  React.useEffect(() => {
    let cancelled = false
    load()
      .then((x) => !cancelled && setValues(initialValues(fields, x as Values)))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
    // fields are rebuilt every render; loading once per block is enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, key])
  if (!values) return <Skeleton className="h-48 w-full" />
  const errors = fieldErrors(fields, values, t)
  const valid = !Object.values(errors).some(Boolean)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t(title)}</CardTitle>
        {hint && <CardDescription>{t(hint)}</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-4">
        <fieldset disabled={!manage} className="contents">
          <FormFields fields={fields} values={values} onChange={setValues} errors={errors} prefix={title.replaceAll(".", "-")} />
        </fieldset>
        {manage && (
          <Button className="w-fit" disabled={!valid} onClick={async () => (await attempt(() => save({ ...toBody(fields, values), ...extraBody?.(values) } as T), t("common.saved"))) && setKey((x) => x + 1)}>
            {t("common.save")}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

/** Own SMTP (password write-only: empty keeps it) or the platform's; test mail; reset to the platform. */
function EmailBlock({ manage }: { manage: boolean }) {
  const t = useT()
  const [info, setInfo] = React.useState<{ usingPlatform?: boolean; passwordSet?: boolean }>()
  const [to, setTo] = React.useState("")
  const [key, setKey] = React.useState(0)
  const load = React.useCallback(
    () =>
      S.email().then((e) => {
        setInfo({ usingPlatform: e.usingPlatform, passwordSet: e.passwordSet })
        return { ...e, password: "" }
      }),
    [],
  )
  const fields: FieldDef[] = [
    { name: "enabled", label: "co.f.ownSmtp", type: "switch", full: true },
    { name: "host", label: "co.f.host", required: true, max: 255, hidden: (v) => !v.enabled },
    { name: "port", label: "co.f.port", type: "number", required: true, min: 1, max: 65535, hidden: (v) => !v.enabled },
    { name: "username", label: "co.username", max: 255, hidden: (v) => !v.enabled },
    { name: "password", label: info?.passwordSet ? "co.f.passwordKeep" : "hr.f.password", type: "password", max: 255, hidden: (v) => !v.enabled },
    { name: "encryption", label: "co.f.encryption", type: "select", required: true, options: raw(["TLS", "SSL", "NONE"]), hidden: (v) => !v.enabled },
    { name: "fromAddress", label: "co.f.fromAddress", type: "email", required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMsg: "hr.v.email", hidden: (v) => !v.enabled },
    { name: "fromName", label: "co.f.fromName", max: 100, hidden: (v) => !v.enabled },
  ]
  return (
    <div className="grid gap-4">
      {info && <Badge variant={info.usingPlatform ? "outline" : "default"}>{t(info.usingPlatform ? "co.email.usingPlatform" : "co.email.usingOwn")}</Badge>}
      <Block key={key} title="co.tab.email" hint="co.email.hint" fields={fields} load={load} save={(b: Values) => (b.enabled ? S.saveEmail(b) : S.resetEmail())} manage={manage} />
      {manage && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-2 pt-6">
            <Input className="w-64" type="email" aria-label={t("co.email.testTo")} placeholder={t("co.email.testTo")} value={to} onChange={(e) => setTo(e.target.value)} />
            <Button variant="outline" disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)} onClick={() => attempt(() => S.testEmail(to.trim()), t("co.email.testSent"))}>
              <Send className="size-4" /> {t("co.email.test")}
            </Button>
            {info && !info.usingPlatform && (
              <Button variant="ghost" onClick={async () => (await attempt(() => S.resetEmail(), t("common.saved"))) && setKey((x) => x + 1)}>
                {t("co.email.reset")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Notifications({ manage }: { manage: boolean }) {
  const t = useT()
  const [groups, setGroups] = React.useState<NotificationGroup[]>()
  const [key, setKey] = React.useState(0)
  React.useEffect(() => {
    let cancelled = false
    S.notifications()
      .then((g) => !cancelled && setGroups(g ?? []))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [key])
  if (!groups) return <Skeleton className="h-48 w-full" />
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((g) => (
        <Card key={g.module}>
          <CardHeader>
            <CardTitle className="text-base">{t(`co.module.${g.module ?? "GENERAL"}` as TranslationKey)}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {(g.notifications ?? []).map((n) => (
              <label key={n.code} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {n.name}
                  {!n.dispatched && <span className="text-muted-foreground ml-1 text-xs">({t("co.notDispatched")})</span>}
                </span>
                <Switch disabled={!manage} checked={!!n.enabled} aria-label={n.name} onCheckedChange={async (c) => (await attempt(() => S.toggleNotification(n.code ?? "", c), t("common.saved"))) && setKey((x) => x + 1)} />
              </label>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/** Slack, Telegram, Twilio, AI assistant, Google Calendar: secrets are write-only (empty = keep the stored one). */
function IntegrationsTab({ manage }: { manage: boolean }) {
  const t = useT()
  const [data, setData] = React.useState<Integrations>()
  const [key, setKey] = React.useState(0)
  React.useEffect(() => {
    let cancelled = false
    S.integrations()
      .then((x) => !cancelled && setData(x))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [key])
  if (!data) return <Skeleton className="h-48 w-full" />
  const keep = (has?: boolean) => (has ? "co.f.secretKeep" : undefined)
  const blocks: { type: EIntegration; title: TranslationKey; view: Record<string, unknown> | undefined; fields: FieldDef[]; test?: "slack" | "telegram" }[] = [
    { type: "slack", title: "co.int.slack", view: data.slack, test: "slack", fields: [{ name: "webhookUrl", label: (keep(data.slack?.hasWebhookUrl) ?? "co.f.webhookUrl") as TranslationKey, type: "password", max: 500, pattern: /^https:\/\/hooks\.slack\.com\/\S+$/, patternMsg: "co.v.slack" }] },
    {
      type: "telegram",
      title: "co.int.telegram",
      view: data.telegram,
      test: "telegram",
      fields: [
        { name: "botToken", label: (keep(data.telegram?.hasBotToken) ?? "co.f.botToken") as TranslationKey, type: "password", max: 100, pattern: /^[0-9]{3,20}:[A-Za-z0-9_-]{20,80}$/, patternMsg: "hr.v.format" },
        { name: "chatId", label: "co.f.chatId", max: 64, pattern: /^(-?[0-9]{1,20}|@[A-Za-z0-9_]{4,32})$/, patternMsg: "hr.v.format" },
      ],
    },
    {
      type: "twilio",
      title: "co.int.twilio",
      view: data.twilio,
      fields: [
        { name: "accountSid", label: "co.f.accountSid", max: 34, pattern: /^AC[0-9a-fA-F]{32}$/, patternMsg: "hr.v.format" },
        { name: "authToken", label: (keep(data.twilio?.hasAuthToken) ?? "co.f.authToken") as TranslationKey, type: "password", max: 100 },
        { name: "fromNumber", label: "co.f.fromNumber", max: 20, pattern: /^\+[1-9][0-9]{6,14}$/, patternMsg: "co.v.phoneE164" },
      ],
    },
    {
      type: "ai-assistant",
      title: "co.int.ai",
      view: data.aiAssistant,
      fields: [
        { name: "provider", label: "co.f.provider", type: "select", none: true, options: raw(["OPENAI", "ANTHROPIC", "GOOGLE"]) },
        { name: "model", label: "co.f.model", max: 100, pattern: /^[A-Za-z0-9._:/-]{1,100}$/, patternMsg: "hr.v.format" },
        { name: "apiKey", label: (keep(data.aiAssistant?.hasApiKey) ?? "co.f.apiKey") as TranslationKey, type: "password", max: 500 },
      ],
    },
    {
      type: "google-calendar",
      title: "co.int.google",
      view: data.googleCalendar,
      fields: [
        { name: "calendarId", label: "co.f.calendarId", max: 255 },
        { name: "serviceAccountJson", label: (keep(data.googleCalendar?.hasServiceAccountJson) ?? "co.f.serviceAccount") as TranslationKey, type: "textarea", max: 20000 },
      ],
    },
  ]
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {blocks.map((b) => (
        <IntegrationCard key={`${b.type}-${key}`} {...b} manage={manage} onChanged={() => setKey((x) => x + 1)} />
      ))}
      <p className="text-muted-foreground text-sm lg:col-span-2">{t("co.int.zoomHint")}</p>
    </div>
  )
}

function IntegrationCard({ type, title, view, fields, test, manage, onChanged }: { type: EIntegration; title: TranslationKey; view?: Record<string, unknown>; fields: FieldDef[]; test?: "slack" | "telegram"; manage: boolean; onChanged: () => void }) {
  const t = useT()
  const all: FieldDef[] = [{ name: "enabled", label: "co.f.enabled", type: "switch" }, ...fields]
  const [values, setValues] = React.useState<Values>(() => initialValues(all, { ...(view ?? {}), webhookUrl: "", botToken: "", authToken: "", apiKey: "", serviceAccountJson: "" }))
  const errors = fieldErrors(all, values, t)
  const valid = !Object.values(errors).some(Boolean)
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base">{t(title)}</CardTitle>
          <CardDescription>
            {view?.configured ? t("co.int.configured") : t("co.int.notConfigured")}
            {view?.serviceAccountEmail ? ` · ${String(view.serviceAccountEmail)}` : ""}
          </CardDescription>
        </div>
        <Badge variant={view?.enabled ? "default" : "outline"}>{t(view?.enabled ? "co.int.on" : "co.int.off")}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        <fieldset disabled={!manage} className="contents">
          <FormFields fields={all} values={values} onChange={setValues} errors={errors} prefix={`int-${type}`} />
        </fieldset>
        {manage && (
          <div className="flex flex-wrap gap-2">
            <Button disabled={!valid} onClick={async () => (await attempt(() => S.saveIntegration(type, toBody(all, values)), t("common.saved"))) && onChanged()}>
              {t("common.save")}
            </Button>
            {test && !!view?.configured && (
              <Button variant="outline" onClick={() => attempt(() => S.testIntegration(test), t("co.int.testSent"))}>
                <Zap className="size-4" /> {t("co.int.test")}
              </Button>
            )}
            {!!view?.configured && (
              <Button variant="ghost" onClick={async () => (await attempt(() => S.removeIntegration(type), t("common.saved"))) && onChanged()}>
                {t("co.int.remove")}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Webhooks per event (sales, purchase, accounting, recruitment, training, project, CRM, contract, HRM): URL, secret (write-only), active, test. */
function Webhooks({ manage }: { manage: boolean }) {
  const t = useT()
  const [events, setEvents] = React.useState<{ value: string; label: string }[]>([])
  React.useEffect(() => {
    let cancelled = false
    S.events()
      .then((g) => !cancelled && setEvents((g ?? []).flatMap((x) => (x.events ?? []).map((e) => ({ value: String(e.code), label: `${t(`co.module.${x.module ?? "GENERAL"}` as TranslationKey)} · ${e.name}` })))))
      .catch((e) => !cancelled && toast.error(errorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [t])
  const cfg: CrudConfig = {
    id: "webhooks",
    load: S.webhooks as CrudConfig["load"],
    columns: [
      { label: "co.event", render: (r) => <span>{String(r.eventName ?? r.eventCode)}<span className="text-muted-foreground block text-xs">{t(`co.module.${String(r.module ?? "GENERAL")}` as TranslationKey)}</span></span> },
      { label: "co.f.url", render: (r) => <span className="font-mono text-xs break-all">{String(r.url ?? "")}</span> },
      { label: "co.secret", path: "hasSecret", kind: "bool" },
      { label: "hr.f.active", path: "active", kind: "bool" },
    ],
    rowName: (r) => String(r.eventName ?? r.eventCode ?? ""),
    createLabel: "co.webhook.create",
    fields: [
      { name: "eventCode", label: "co.event", type: "select", required: true, options: events, full: true },
      { name: "url", label: "co.f.url", required: true, max: 1000, pattern: url, patternMsg: "tr.v.url", full: true },
      // HMAC signing secret: 16..200 characters (WebhookService); empty keeps the stored one
      { name: "secret", label: "co.f.secretOptional", type: "password", max: 200, check: (v) => (v.secret && String(v.secret).length < 16 ? "co.v.secret" : undefined) },
      { name: "active", label: "hr.f.active", type: "switch" },
    ],
    defaults: { active: true },
    toValues: (r: Row) => ({ ...r, secret: "" }),
    save: (id, b) => S.saveWebhook(id, { method: "POST", ...b }),
    remove: S.removeWebhook,
    actions: [{ key: "test", label: "co.int.test", icon: <Zap className="size-4" />, when: () => true, confirmDesc: "co.webhook.testDesc", run: (r) => S.testWebhook(r.id ?? "") }],
    manage,
  }
  return <CrudSection config={cfg} />
}
