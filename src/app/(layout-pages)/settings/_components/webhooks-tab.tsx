"use client"

import * as React from "react"
import Link from "next/link"
import { Zap } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PlatformSettingsService as S } from "@/lib/admin/admin.service"
import type { Row } from "@/lib/hrm/hrm.service"
import { useT } from "@/lib/i18n"
import { ensureDelivered } from "@/lib/webhook-test"

import { CrudSection, errorMessage, type CrudConfig } from "../../hrm/_components/crud-kit"

// PlatformWebhookForm: url https only (public host, port 443/8443: SETTINGS_013 otherwise), method POST only, secret
// write-only 16..200 (update: blank keeps it, removeSecret = true removes it), unknown event SETTINGS_014.
const HTTPS = /^https:\/\/\S+$/

/**
 * Platform webhooks (manual §3.7 Webhooks; PlatformWebhookController /settings/admin/webhooks, super admin): a POST of
 * JSON {event, eventName, module: PLATFORM, eventId, companyId: null, occurredAt, data} for platform events (new
 * company, plan orders, new user, helpdesk), signed with HMAC when a secret is set. Deliveries: notification log, Platform.
 */
export function WebhooksTab() {
  const t = useT()
  const [events, setEvents] = React.useState<{ value: string; label: string }[]>([])
  React.useEffect(() => {
    let cancelled = false
    S.webhookEvents()
      .then((e) => !cancelled && setEvents((e ?? []).map((x) => ({ value: String(x.code), label: String(x.name ?? x.code) }))))
      .catch((e) => !cancelled && toast.error(errorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [])
  const cfg: CrudConfig = {
    id: "platform-webhooks",
    load: S.webhooks as CrudConfig["load"],
    manage: true,
    rowName: (r) => String(r.eventName ?? r.eventCode ?? ""),
    createLabel: "co.webhook.create",
    columns: [
      { label: "co.event", render: (r) => <span>{String(r.eventName ?? r.eventCode ?? "-")}<span className="text-muted-foreground block font-mono text-xs">{String(r.eventCode ?? "")}</span></span> },
      { label: "co.f.url", render: (r) => <span className="font-mono text-xs break-all">{String(r.url ?? "")}</span> },
      { label: "co.secret", path: "hasSecret", kind: "bool" },
      { label: "hr.f.active", path: "active", kind: "bool" },
    ],
    fields: [
      { name: "eventCode", label: "co.event", type: "select", required: true, options: events, full: true },
      { name: "url", label: "co.f.url", required: true, max: 1000, pattern: HTTPS, patternMsg: "pwh.httpsOnly", full: true },
      { name: "secret", label: "co.f.secretOptional", type: "password", max: 200, hidden: (v) => v.removeSecret === true, check: (v) => (v.secret && String(v.secret).length < 16 ? "co.v.secret" : undefined) },
      // only for a webhook that has a secret: removes it on save
      { name: "removeSecret", label: "pwh.removeSecret", type: "switch", hidden: (v) => v.hasSecret !== true },
      { name: "hasSecret", label: "co.secret", type: "switch", hidden: () => true },
      { name: "active", label: "hr.f.active", type: "switch" },
    ],
    defaults: { active: true },
    toValues: (r: Row) => ({ ...r, secret: "", removeSecret: false }),
    save: (id, b) => {
      const body = { eventCode: String(b.eventCode ?? ""), url: String(b.url ?? ""), method: "POST" as const, active: b.active === true, secret: (b.secret as string | undefined) || undefined, removeSecret: id ? b.removeSecret === true : undefined }
      return id ? S.updateWebhook(id, body) : S.createWebhook(body)
    },
    remove: S.removeWebhook,
    actions: [{ key: "test", label: "co.int.test", icon: <Zap className="size-4" />, when: () => true, confirmDesc: "co.webhook.testDesc", run: (r) => S.testWebhook(String(r.id ?? "")).then((x) => ensureDelivered(x, (f) => t("pwh.testFailed", { reason: f.statusCode ? `HTTP ${f.statusCode}` : f.failure || "-" }))) }],
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pwh.title")}</CardTitle>
        <CardDescription>
          {t("pwh.desc")}{" "}
          <Link href="/notifications?companyId=platform" className="text-primary underline">
            {t("pwh.log")}
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CrudSection config={cfg} />
      </CardContent>
    </Card>
  )
}
