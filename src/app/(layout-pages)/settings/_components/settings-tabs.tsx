"use client"

import * as React from "react"
import { Download, Send } from "lucide-react"
import { toast } from "sonner"

import { FieldError, PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useLanguages } from "@/hooks/use-public-settings"
import {
  PlatformSettingsService as S,
  type BankTransferSettings,
  type BrandSettings,
  type CookieSettings,
  type CurrencyFormat,
  type CurrencySettingsView,
  type EmailSettingsView,
  type RecaptchaSettingsView,
  type SeoSettings,
  type StorageSettings,
  type StripeMode,
  type StripeSettingsView,
  type SystemSettings,
} from "@/lib/admin/admin.service"
import { formatMoney } from "@/lib/format"
import { useT, type TranslationKey } from "@/lib/i18n"
import { saveBlob } from "@/lib/pos/pos.service"

import { FieldRow, SelectRow, SettingsCard, SwitchRow, useSettingsBlock } from "./settings-kit"

const id = <V,>(v: V) => v

/** Only the listed keys: the PUT bodies must not carry view-only fields (passwordSet, symbol…). */
function pick<O extends object, K extends keyof O>(o: O, keys: K[]): Pick<O, K> {
  return Object.fromEntries(keys.map((k) => [k, o[k]])) as Pick<O, K>
}

// ---------------------------------------------------------------- Brand

export function BrandTab() {
  const t = useT()
  const b = useSettingsBlock<BrandSettings>(S.brand, S.saveBrand, id)
  const f = b.form
  return (
    <SettingsCard title={t("settings.brand")} description={t("settings.brandDesc")} {...cardProps(b)}>
      {f && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow id="titleText" label={t("settings.titleText")}>
              <Input id="titleText" maxLength={100} value={f.titleText ?? ""} onChange={(e) => b.patch({ titleText: e.target.value })} />
            </FieldRow>
            <FieldRow id="footerText" label={t("settings.footerText")}>
              <Input id="footerText" maxLength={255} value={f.footerText ?? ""} onChange={(e) => b.patch({ footerText: e.target.value })} />
            </FieldRow>
            <FieldRow id="logoLightUrl" label={t("settings.logoLight")} hint={t("settings.urlHint")}>
              <Input id="logoLightUrl" maxLength={1000} value={f.logoLightUrl ?? ""} onChange={(e) => b.patch({ logoLightUrl: e.target.value })} />
            </FieldRow>
            <FieldRow id="logoDarkUrl" label={t("settings.logoDark")} hint={t("settings.urlHint")}>
              <Input id="logoDarkUrl" maxLength={1000} value={f.logoDarkUrl ?? ""} onChange={(e) => b.patch({ logoDarkUrl: e.target.value })} />
            </FieldRow>
            <FieldRow id="faviconUrl" label={t("settings.favicon")} hint={t("settings.urlHint")}>
              <Input id="faviconUrl" maxLength={1000} value={f.faviconUrl ?? ""} onChange={(e) => b.patch({ faviconUrl: e.target.value })} />
            </FieldRow>
            <FieldRow id="themeColor" label={t("settings.themeColor")} hint={t("settings.themeColorHint")}>
              <div className="flex gap-2">
                <Input id="themeColor" value={f.themeColor ?? ""} onChange={(e) => b.patch({ themeColor: e.target.value })} />
                <input
                  type="color"
                  aria-label={t("settings.themeColor")}
                  className="h-9 w-12 cursor-pointer rounded border"
                  value={/^#[0-9a-fA-F]{6}$/.test(f.themeColor ?? "") ? f.themeColor! : "#1e5eaf"}
                  onChange={(e) => b.patch({ themeColor: e.target.value })}
                />
              </div>
            </FieldRow>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SelectRow
              id="sidebarVariant"
              label={t("settings.sidebarVariant")}
              value={f.sidebarVariant}
              onChange={(v) => b.patch({ sidebarVariant: v })}
              options={[
                { value: "INSET", label: "Inset" },
                { value: "FLOATING", label: "Floating" },
                { value: "MINIMAL", label: "Minimal" },
              ]}
            />
            <SelectRow
              id="sidebarStyle"
              label={t("settings.sidebarStyle")}
              value={f.sidebarStyle}
              onChange={(v) => b.patch({ sidebarStyle: v })}
              options={[
                { value: "PLAIN", label: "Plain" },
                { value: "COLORED", label: "Colored" },
                { value: "GRADIENT", label: "Gradient" },
              ]}
            />
            <SelectRow
              id="layoutDirection"
              label={t("settings.layoutDirection")}
              value={f.layoutDirection}
              onChange={(v) => b.patch({ layoutDirection: v })}
              options={[
                { value: "LTR", label: "LTR" },
                { value: "RTL", label: "RTL" },
              ]}
            />
            <SelectRow
              id="themeMode"
              label={t("settings.themeMode")}
              value={f.themeMode}
              onChange={(v) => b.patch({ themeMode: v })}
              options={[
                { value: "LIGHT", label: t("settings.light") },
                { value: "DARK", label: t("settings.dark") },
                { value: "SYSTEM", label: t("settings.system") },
              ]}
            />
          </div>
        </>
      )}
    </SettingsCard>
  )
}

// ---------------------------------------------------------------- System

export function SystemTab() {
  const t = useT()
  const languages = useLanguages()
  const b = useSettingsBlock<SystemSettings>(S.system, S.saveSystem, id)
  const f = b.form
  return (
    <SettingsCard title={t("settings.systemTab")} description={t("settings.systemDesc")} {...cardProps(b)}>
      {f && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectRow
              id="defaultLanguage"
              label={t("settings.defaultLanguage")}
              value={f.defaultLanguage}
              onChange={(v) => b.patch({ defaultLanguage: v })}
              options={languages.filter((l) => l.code).map((l) => ({ value: l.code!, label: l.name ?? l.code! }))}
            />
            <SelectRow
              id="dateFormat"
              label={t("settings.dateFormat")}
              value={f.dateFormat}
              onChange={(v) => b.patch({ dateFormat: v })}
              options={["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "dd-MM-yyyy", "dd.MM.yyyy"].map((v) => ({ value: v, label: v }))}
            />
            <SelectRow
              id="timeFormat"
              label={t("settings.timeFormat")}
              value={f.timeFormat}
              onChange={(v) => b.patch({ timeFormat: v })}
              options={[
                { value: "HH:mm", label: "24h (HH:mm)" },
                { value: "HH:mm:ss", label: "24h (HH:mm:ss)" },
                { value: "hh:mm a", label: "12h (hh:mm a)" },
              ]}
            />
            <SelectRow
              id="calendarStartDay"
              label={t("settings.calendarStartDay")}
              value={f.calendarStartDay}
              onChange={(v) => b.patch({ calendarStartDay: v })}
              options={["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map((d, i) => ({
                value: d,
                label: new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: "long" }),
              }))}
            />
            <FieldRow id="defaultTimezone" label={t("settings.timezone")} hint="IANA, e.g. Asia/Ho_Chi_Minh">
              <Input
                id="defaultTimezone"
                maxLength={60}
                value={f.defaultTimezone ?? ""}
                onChange={(e) => b.patch({ defaultTimezone: e.target.value })}
              />
            </FieldRow>
            <FieldRow id="termsUrl" label={t("settings.termsUrl")}>
              <Input id="termsUrl" type="url" maxLength={500} value={f.termsUrl ?? ""} onChange={(e) => b.patch({ termsUrl: e.target.value })} />
            </FieldRow>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SwitchRow label={t("settings.userRegistration")} checked={!!f.userRegistration} onChange={(v) => b.patch({ userRegistration: v })} />
            <SwitchRow label={t("settings.emailVerification")} checked={!!f.emailVerification} onChange={(v) => b.patch({ emailVerification: v })} />
            <SwitchRow label={t("settings.landingPage")} checked={!!f.landingPage} onChange={(v) => b.patch({ landingPage: v })} />
            <SwitchRow
              label={t("settings.ipRestriction")}
              hint={t("settings.ipRestrictionHint")}
              checked={f.ipRestriction !== false}
              onChange={(v) => b.patch({ ipRestriction: v })}
            />
          </div>
        </>
      )}
    </SettingsCard>
  )
}

// ---------------------------------------------------------------- Currency

type CurrencyForm = Required<CurrencyFormat> & { code?: string; symbol?: string }

export function CurrencyTab() {
  const t = useT()
  const b = useSettingsBlock<CurrencySettingsView, CurrencyForm>(
    S.currency,
    (f) => S.saveCurrency(pick(f, ["decimalPlaces", "symbolPosition", "decimalSeparator", "thousandsSeparator", "showDecimals", "addSpace"])),
    (v) => ({
      decimalPlaces: v.format?.decimalPlaces ?? 0,
      symbolPosition: v.format?.symbolPosition ?? "AFTER",
      decimalSeparator: v.format?.decimalSeparator ?? "COMMA",
      thousandsSeparator: v.format?.thousandsSeparator ?? "DOT",
      showDecimals: !!v.format?.showDecimals,
      addSpace: v.format?.addSpace ?? true,
      code: v.defaultCurrencyCode,
      symbol: v.defaultCurrencySymbol,
    })
  )
  const f = b.form
  return (
    <SettingsCard title={t("settings.currency")} description={t("settings.currencyDesc")} {...cardProps(b)}>
      {f && (
        <>
          <p className="text-sm">
            {t("settings.defaultCurrency")}: <span className="font-medium">{f.code ?? "-"} ({f.symbol ?? "-"})</span>
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SelectRow
              id="symbolPosition"
              label={t("settings.symbolPosition")}
              value={f.symbolPosition}
              onChange={(v) => b.patch({ symbolPosition: v })}
              options={[
                { value: "BEFORE", label: t("settings.before") },
                { value: "AFTER", label: t("settings.after") },
              ]}
            />
            <SelectRow
              id="thousandsSeparator"
              label={t("settings.thousandsSeparator")}
              value={f.thousandsSeparator}
              onChange={(v) => b.patch({ thousandsSeparator: v })}
              options={[
                { value: "DOT", label: t("settings.dot") },
                { value: "COMMA", label: t("settings.comma") },
              ]}
            />
            <SelectRow
              id="decimalSeparator"
              label={t("settings.decimalSeparator")}
              value={f.decimalSeparator}
              onChange={(v) => b.patch({ decimalSeparator: v })}
              options={[
                { value: "DOT", label: t("settings.dot") },
                { value: "COMMA", label: t("settings.comma") },
              ]}
            />
            <SelectRow
              id="decimalPlaces"
              label={t("settings.decimalPlaces")}
              value={String(f.decimalPlaces) as "0" | "1" | "2" | "3" | "4"}
              onChange={(v) => b.patch({ decimalPlaces: Number(v) })}
              options={(["0", "1", "2", "3", "4"] as const).map((v) => ({ value: v, label: v }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SwitchRow label={t("settings.showDecimals")} checked={f.showDecimals} onChange={(v) => b.patch({ showDecimals: v })} />
            <SwitchRow label={t("settings.addSpace")} checked={f.addSpace} onChange={(v) => b.patch({ addSpace: v })} />
          </div>
          <p className="text-muted-foreground text-sm">
            {t("settings.preview")}:{" "}
            <span className="text-foreground font-medium" data-testid="currency-preview">
              {formatMoney(1234567.891, f)}
            </span>
          </p>
        </>
      )}
    </SettingsCard>
  )
}

// ---------------------------------------------------------------- SEO

export function SeoTab() {
  const t = useT()
  const b = useSettingsBlock<SeoSettings>(S.seo, S.saveSeo, id)
  const f = b.form
  return (
    <SettingsCard title={t("settings.seo")} description={t("settings.seoDesc")} {...cardProps(b)}>
      {f && (
        <>
          <FieldRow id="metaKeywords" label={t("settings.metaKeywords")} hint={t("settings.metaKeywordsHint")}>
            <Input id="metaKeywords" maxLength={500} value={f.metaKeywords ?? ""} onChange={(e) => b.patch({ metaKeywords: e.target.value })} />
          </FieldRow>
          <FieldRow
            id="metaDescription"
            label={t("settings.metaDescription")}
            hint={t("settings.metaDescriptionHint", { n: (f.metaDescription ?? "").length })}
          >
            <Textarea
              id="metaDescription"
              maxLength={500}
              value={f.metaDescription ?? ""}
              onChange={(e) => b.patch({ metaDescription: e.target.value })}
            />
          </FieldRow>
          <FieldRow id="metaImageUrl" label={t("settings.metaImage")} hint={t("settings.metaImageHint")}>
            <Input id="metaImageUrl" maxLength={1000} value={f.metaImageUrl ?? ""} onChange={(e) => b.patch({ metaImageUrl: e.target.value })} />
          </FieldRow>
        </>
      )}
    </SettingsCard>
  )
}

// ---------------------------------------------------------------- Email (SMTP)

type EmailForm = Omit<EmailSettingsView, "passwordSet"> & { password: string; passwordSet: boolean }

export function EmailTab() {
  const t = useT()
  const [testTo, setTestTo] = React.useState("")
  const [testing, setTesting] = React.useState(false)
  const b = useSettingsBlock<EmailSettingsView, EmailForm>(
    S.email,
    // Empty password field = keep the stored one (omit it); the password is write-only.
    (f) => S.saveEmail({ ...pick(f, ["host", "port", "username", "encryption", "fromAddress", "fromName"]), ...(f.password ? { password: f.password } : {}) }),
    (v) => ({ ...v, password: "", passwordSet: !!v.passwordSet, encryption: v.encryption ?? "TLS", port: v.port ?? 587 })
  )
  const f = b.form

  async function sendTest() {
    if (!testTo.trim()) return
    setTesting(true)
    try {
      await S.testEmail(testTo.trim())
      toast.success(t("settings.testSent", { to: testTo.trim() }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setTesting(false)
    }
  }

  return (
    <SettingsCard title={t("settings.email")} description={t("settings.emailDesc")} {...cardProps(b)}>
      {f && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow id="host" label={t("settings.smtpHost")}>
              <Input id="host" maxLength={255} value={f.host ?? ""} onChange={(e) => b.patch({ host: e.target.value })} />
            </FieldRow>
            <FieldRow id="port" label={t("settings.smtpPort")}>
              <Input
                id="port"
                type="number"
                min={1}
                max={65535}
                value={f.port ?? ""}
                onChange={(e) => b.patch({ port: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </FieldRow>
            <FieldRow id="username" label={t("settings.smtpUsername")}>
              <Input id="username" autoComplete="off" maxLength={255} value={f.username ?? ""} onChange={(e) => b.patch({ username: e.target.value })} />
            </FieldRow>
            <FieldRow id="smtpPassword" label={t("settings.smtpPassword")} hint={f.passwordSet ? t("settings.secretKept") : undefined}>
              <PasswordInput
                id="smtpPassword"
                withIcon={false}
                autoComplete="new-password"
                maxLength={255}
                value={f.password}
                onChange={(e) => b.patch({ password: e.target.value })}
              />
            </FieldRow>
            <SelectRow
              id="encryption"
              label={t("settings.encryption")}
              value={f.encryption}
              onChange={(v) => b.patch({ encryption: v })}
              options={[
                { value: "TLS", label: "TLS" },
                { value: "SSL", label: "SSL" },
                { value: "NONE", label: t("settings.none") },
              ]}
            />
            <FieldRow id="fromAddress" label={t("settings.fromAddress")}>
              <Input id="fromAddress" type="email" value={f.fromAddress ?? ""} onChange={(e) => b.patch({ fromAddress: e.target.value })} />
            </FieldRow>
            <FieldRow id="fromName" label={t("settings.fromName")}>
              <Input id="fromName" maxLength={100} value={f.fromName ?? ""} onChange={(e) => b.patch({ fromName: e.target.value })} />
            </FieldRow>
          </div>
          <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
            <FieldRow id="testTo" label={t("settings.sendTestTo")}>
              <Input id="testTo" type="email" className="w-64" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            </FieldRow>
            <Button type="button" variant="outline" onClick={sendTest} disabled={testing || !testTo.trim()}>
              <Send className="size-4" /> {t("settings.sendTest")}
            </Button>
          </div>
        </>
      )}
    </SettingsCard>
  )
}

// ---------------------------------------------------------------- reCAPTCHA

type RecaptchaForm = { enabled: boolean; version: "V2" | "V3"; siteKey: string; secret: string; secretSet: boolean }

export function RecaptchaTab() {
  const t = useT()
  const b = useSettingsBlock<RecaptchaSettingsView, RecaptchaForm>(
    S.recaptcha,
    (f) => S.saveRecaptcha({ ...pick(f, ["enabled", "version", "siteKey"]), ...(f.secret ? { secret: f.secret } : {}) }),
    (v) => ({ enabled: !!v.enabled, version: v.version ?? "V2", siteKey: v.siteKey ?? "", secret: "", secretSet: !!v.secretSet })
  )
  const f = b.form
  return (
    <SettingsCard title="reCAPTCHA" description={t("settings.recaptchaDesc")} {...cardProps(b)}>
      {f && (
        <>
          <SwitchRow label={t("settings.recaptchaEnable")} checked={f.enabled} onChange={(v) => b.patch({ enabled: v })} />
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectRow
              id="version"
              label={t("settings.version")}
              value={f.version}
              onChange={(v) => b.patch({ version: v })}
              options={[
                { value: "V2", label: "v2" },
                { value: "V3", label: "v3" },
              ]}
            />
            <FieldRow id="siteKey" label={t("settings.siteKey")}>
              <Input id="siteKey" maxLength={200} value={f.siteKey} onChange={(e) => b.patch({ siteKey: e.target.value })} />
            </FieldRow>
            <FieldRow id="secretKey" label={t("settings.secretKey")} hint={f.secretSet ? t("settings.secretKept") : undefined}>
              <PasswordInput
                id="secretKey"
                withIcon={false}
                autoComplete="off"
                maxLength={200}
                value={f.secret}
                onChange={(e) => b.patch({ secret: e.target.value })}
              />
            </FieldRow>
          </div>
        </>
      )}
    </SettingsCard>
  )
}

// ---------------------------------------------------------------- Storage

// Types media-service can verify by content (StorageSettings.SUPPORTED).
const SUPPORTED_TYPES = ["png", "jpg", "jpeg", "gif", "webp", "pdf", "doc", "docx", "xls", "xlsx", "pptx", "txt", "csv"]

export function StorageTab() {
  const t = useT()
  const b = useSettingsBlock<StorageSettings, Required<StorageSettings>>(S.storage, S.saveStorage, (v) => ({
    allowedFileTypes: v.allowedFileTypes ?? [],
    maxUploadSizeKb: v.maxUploadSizeKb ?? 10240,
  }))
  const f = b.form
  return (
    <SettingsCard title={t("settings.storage")} description={t("settings.storageDesc")} {...cardProps(b)}>
      {f && (
        <>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{t("settings.allowedTypes")}</legend>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_TYPES.map((ext) => {
                const on = f.allowedFileTypes.includes(ext)
                return (
                  <Button
                    key={ext}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    aria-pressed={on}
                    onClick={() =>
                      b.patch({
                        allowedFileTypes: on ? f.allowedFileTypes.filter((x) => x !== ext) : [...f.allowedFileTypes, ext],
                      })
                    }
                  >
                    .{ext}
                  </Button>
                )
              })}
            </div>
            {f.allowedFileTypes.length === 0 && <p className="text-destructive text-xs">{t("settings.pickOneType")}</p>}
          </fieldset>
          <FieldRow id="maxUploadSizeKb" label={t("settings.maxUpload")} hint={t("settings.maxUploadHint")}>
            <Input
              id="maxUploadSizeKb"
              type="number"
              min={1}
              max={1048576}
              className="w-48"
              value={f.maxUploadSizeKb}
              onChange={(e) => b.patch({ maxUploadSizeKb: Number(e.target.value) })}
            />
          </FieldRow>
        </>
      )}
    </SettingsCard>
  )
}

function cardProps(b: { form: unknown; error?: string; saving: boolean; submit: (e?: React.FormEvent) => void }) {
  return { loading: !b.form, error: b.error, saving: b.saving, onSubmit: (e: React.FormEvent) => b.submit(e) }
}

// ---------------------------------------------------------------- Cookie

const COOKIE_TEXTS: { key: keyof CookieSettings; label: TranslationKey; max: number; long?: boolean }[] = [
  { key: "cookieTitle", label: "settings.cookieTitle", max: 200 },
  { key: "cookieDescription", label: "settings.cookieDescription", max: 2000, long: true },
  { key: "strictlyTitle", label: "settings.strictlyTitle", max: 200 },
  { key: "strictlyDescription", label: "settings.strictlyDescription", max: 2000, long: true },
  { key: "contactDescription", label: "settings.contactDescription", max: 2000, long: true },
]
const URL_RE = /^https?:\/\/.+/
const isoDay = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Cookie consent banner of the public website (/site) and logging of visitors' choices (GET/PUT /settings/admin/cookie,
 * full replacement), plus the accepted-cookies CSV of a period (≤366 days, SITE_007; only while logging was on).
 */
export function CookieTab() {
  const t = useT()
  const b = useSettingsBlock<CookieSettings>(S.cookie, S.saveCookie, id)
  const f = b.form
  const urlBad = !!f?.contactUrl && !URL_RE.test(f.contactUrl)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (urlBad) return
    void b.submit()
  }
  return (
    <div className="grid gap-4">
      <SettingsCard title={t("settings.cookie")} description={t("settings.cookieDesc")} {...cardProps(b)} onSubmit={submit}>
        {f && (
          <>
            <SwitchRow label={t("settings.cookieLogging")} hint={t("settings.cookieLoggingHint")} checked={!!f.enableLogging} onChange={(v) => b.patch({ enableLogging: v })} />
            {COOKIE_TEXTS.map((x) => (
              <FieldRow key={x.key} id={x.key} label={t(x.label)}>
                {x.long ? (
                  <Textarea id={x.key} maxLength={x.max} value={(f[x.key] as string | null) ?? ""} onChange={(e) => b.patch({ [x.key]: e.target.value })} />
                ) : (
                  <Input id={x.key} maxLength={x.max} value={(f[x.key] as string | null) ?? ""} onChange={(e) => b.patch({ [x.key]: e.target.value })} />
                )}
              </FieldRow>
            ))}
            <FieldRow id="contactUrl" label={t("settings.contactUrl")} hint={t("settings.contactUrlHint")}>
              <Input id="contactUrl" maxLength={500} value={f.contactUrl ?? ""} aria-invalid={urlBad} onChange={(e) => b.patch({ contactUrl: e.target.value.trim() })} />
              <FieldError message={urlBad ? t("settings.contactUrlBad") : undefined} />
            </FieldRow>
          </>
        )}
      </SettingsCard>
      <ConsentExport />
    </div>
  )
}

function ConsentExport() {
  const t = useT()
  const [to, setTo] = React.useState(() => isoDay(new Date()))
  const [from, setFrom] = React.useState(() => isoDay(new Date(Date.now() - 29 * 86400_000)))
  const [busy, setBusy] = React.useState(false)
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400_000) + 1
  const bad = !from || !to ? t("settings.consentRange") : days < 1 ? t("settings.consentReversed") : days > 366 ? t("settings.consentTooLong") : undefined
  const download = async () => {
    setBusy(true)
    try {
      saveBlob(await S.cookieConsentsCsv(from, to), `cookie-consents-${from}_${to}.csv`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.consentExport")}</CardTitle>
        <CardDescription>{t("settings.consentExportDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="consent-from">{t("settings.consentFrom")}</Label>
          <Input id="consent-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="consent-to">{t("settings.consentTo")}</Label>
          <Input id="consent-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button type="button" variant="outline" disabled={busy || !!bad} onClick={download}>
          <Download /> {t("settings.consentDownload")}
        </Button>
        <FieldError message={bad} />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------- Payment (bank transfer, Stripe)

/** Payment methods companies can use on plan orders (§3.7 Payment settings; /settings/admin/payment/*). */
export function PaymentTab() {
  return (
    <div className="grid gap-4">
      <BankTransferCard />
      <StripeCard />
    </div>
  )
}

const BANK_FIELDS: { key: "bankName" | "accountNumber" | "accountName"; label: TranslationKey; max: number }[] = [
  { key: "bankName", label: "settings.bankName", max: 100 },
  { key: "accountNumber", label: "settings.accountNumber", max: 50 },
  { key: "accountName", label: "settings.accountName", max: 100 },
]

function BankTransferCard() {
  const t = useT()
  const b = useSettingsBlock<BankTransferSettings>(S.bankTransfer, S.saveBankTransfer, (v) => ({ ...v, enabled: !!v.enabled }))
  const f = b.form
  return (
    <SettingsCard title={t("settings.bankTransfer")} description={t("settings.bankTransferDesc")} {...cardProps(b)}>
      {f && (
        <>
          <SwitchRow label={t("settings.bankTransferEnable")} checked={!!f.enabled} onChange={(v) => b.patch({ enabled: v })} />
          <div className="grid gap-4 sm:grid-cols-3">
            {BANK_FIELDS.map((x) => (
              <FieldRow key={x.key} id={x.key} label={t(x.label)}>
                <Input id={x.key} maxLength={x.max} value={f[x.key] ?? ""} onChange={(e) => b.patch({ [x.key]: e.target.value })} />
              </FieldRow>
            ))}
          </div>
          <FieldRow id="bankDetails" label={t("settings.bankDetails")} hint={t("settings.bankEnvHint")}>
            <Textarea id="bankDetails" maxLength={1000} value={f.details ?? ""} onChange={(e) => b.patch({ details: e.target.value })} />
          </FieldRow>
        </>
      )}
    </SettingsCard>
  )
}

type StripeForm = {
  enabled: boolean
  mode: StripeMode
  publishableKey: string
  secretKey: string
  webhookSecret: string
  secretKeySet: boolean
  webhookSecretSet: boolean
  /** "remove the stored secret" ticked: sent as "" */
  clearSecret: boolean
  clearWebhook: boolean
  /** mode of the stored keys: the backend checks only keys that are sent, so a mode change needs them re-entered */
  savedMode: StripeMode
}
const PK_RE = /^pk_(test|live)_[A-Za-z0-9]+$/
const WEBHOOK_PATH = "/api/v1/public/payments/stripe/webhook"

/** A write-only secret: typed = the new value, "remove" ticked = "", otherwise omitted (keep the stored one). */
const secretOut = (value: string, clear: boolean) => (value.trim() ? { v: value.trim() } : clear ? { v: "" } : undefined)

function StripeCard() {
  const t = useT()
  const b = useSettingsBlock<StripeSettingsView, StripeForm>(
    S.stripe,
    (f) => {
      const sk = secretOut(f.secretKey, f.clearSecret)
      const wh = secretOut(f.webhookSecret, f.clearWebhook)
      return S.saveStripe({
        enabled: f.enabled,
        mode: f.mode,
        publishableKey: f.publishableKey.trim(),
        ...(sk ? { secretKey: sk.v } : {}),
        ...(wh ? { webhookSecret: wh.v } : {}),
      })
    },
    (v) => ({
      enabled: !!v.enabled,
      mode: v.mode ?? "TEST",
      publishableKey: v.publishableKey ?? "",
      secretKey: "",
      webhookSecret: "",
      secretKeySet: !!v.secretKeySet,
      webhookSecretSet: !!v.webhookSecretSet,
      clearSecret: false,
      clearWebhook: false,
      savedMode: v.mode ?? "TEST",
    })
  )
  const f = b.form
  const prefix = f?.mode === "LIVE" ? "live" : "test"
  const pk = f?.publishableKey.trim() ?? ""
  const sk = f?.secretKey.trim() ?? ""
  const wh = f?.webhookSecret.trim() ?? ""
  const pkErr = pk && !PK_RE.test(pk) ? t("settings.stripePkBad") : pk && !pk.startsWith(`pk_${prefix}_`) ? t("settings.stripeModeBad") : undefined
  const keptOtherMode = !!f && f.mode !== f.savedMode && f.secretKeySet && !f.clearSecret && !sk
  const skErr = sk && !sk.startsWith(`sk_${prefix}_`) && !sk.startsWith(`rk_${prefix}_`) ? t("settings.stripeModeBad") : keptOtherMode ? t("settings.stripeReenter") : undefined
  const whErr = wh && !wh.startsWith("whsec_") ? t("settings.stripeWhBad") : undefined
  const hasSk = !!f && (!!sk || (f.secretKeySet && !f.clearSecret))
  const hasWh = !!f && (!!wh || (f.webhookSecretSet && !f.clearWebhook))
  const incomplete = !!f?.enabled && (!pk || !hasSk || !hasWh)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pkErr || skErr || whErr || incomplete) return
    void b.submit()
  }
  const secretField = (id: "secretKey" | "webhookSecret", label: TranslationKey, set: boolean, clearKey: "clearSecret" | "clearWebhook", err?: string) =>
    f && (
      <FieldRow id={id} label={t(label)} hint={set ? t(f[clearKey] ? "settings.secretWillRemove" : "settings.secretKept") : t("settings.secretNone")}>
        <PasswordInput id={id} withIcon={false} autoComplete="off" maxLength={255} value={f[id]} disabled={f[clearKey]} onChange={(e) => b.patch({ [id]: e.target.value })} aria-invalid={!!err} />
        <FieldError message={err} />
        {set && (
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={f[clearKey]} onCheckedChange={(v) => b.patch({ [clearKey]: v === true, [id]: "" })} aria-label={t("settings.secretRemoveOf", { name: t(label) })} />
            {t("settings.secretRemove")}
          </label>
        )}
      </FieldRow>
    )
  return (
    <SettingsCard title="Stripe" description={t("settings.stripeDesc")} {...cardProps(b)} onSubmit={submit}>
      {f && (
        <>
          <SwitchRow label={t("settings.stripeEnable")} checked={f.enabled} onChange={(v) => b.patch({ enabled: v })} />
          {incomplete && (
            <Alert>
              <AlertDescription>{t("settings.stripeIncomplete")}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectRow
              id="stripeMode"
              label={t("settings.stripeMode")}
              value={f.mode}
              onChange={(v) => b.patch({ mode: v })}
              options={[
                { value: "TEST", label: t("settings.stripeTest") },
                { value: "LIVE", label: t("settings.stripeLive") },
              ]}
            />
            <FieldRow id="publishableKey" label={t("settings.stripePk")}>
              <Input id="publishableKey" maxLength={255} placeholder={`pk_${prefix}_…`} value={f.publishableKey} onChange={(e) => b.patch({ publishableKey: e.target.value })} aria-invalid={!!pkErr} />
              <FieldError message={pkErr} />
            </FieldRow>
            {secretField("secretKey", "settings.stripeSk", f.secretKeySet, "clearSecret", skErr)}
            {secretField("webhookSecret", "settings.stripeWh", f.webhookSecretSet, "clearWebhook", whErr)}
          </div>
          <div className="bg-muted/50 grid gap-1 rounded-md p-3 text-sm">
            <span className="font-medium">{t("settings.stripeWebhookUrl")}</span>
            <code className="text-xs break-all" data-testid="stripe-webhook-path">
              {WEBHOOK_PATH}
            </code>
            <span className="text-muted-foreground text-xs">{t("settings.stripeWebhookHint")}</span>
          </div>
        </>
      )}
    </SettingsCard>
  )
}
