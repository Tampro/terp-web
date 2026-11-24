"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, CalendarCheck, CalendarPlus, Check, Copy, ExternalLink, LogOut, Plus, TrendingUp, UserPlus, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthStore } from "@/lib/auth/auth.store"
import { useT, type TranslationKey } from "@/lib/i18n"
import { SupportService } from "@/lib/support/support.service"

type Action = { href: string; label: TranslationKey; icon: React.ComponentType<{ className?: string }>; any: string[] }

/** HRM dashboard shortcuts (manual §5, as on the reference HRM dashboard): links to the screens, shown by permission. */
const HRM_ACTIONS: Action[] = [
  { href: "/hrm/employees", label: "qa.addEmployee", icon: UserPlus, any: ["EMPLOYEE_CREATE"] },
  { href: "/hrm/attendance?tab=records", label: "qa.markAttendance", icon: CalendarCheck, any: ["ATTENDANCE_MANAGE"] },
  { href: "/hrm/leave", label: "qa.applyLeave", icon: CalendarPlus, any: ["LEAVE_MANAGE", "LEAVE_VIEW"] },
  { href: "/hrm/payroll", label: "qa.processPayroll", icon: Wallet, any: ["PAYROLL_RUN", "PAYROLL_MANAGE"] },
  { href: "/hrm/recognition?tab=promotions", label: "qa.promotion", icon: TrendingUp, any: ["LIFECYCLE_MANAGE"] },
  { href: "/hrm/career?tab=resignations", label: "qa.resignation", icon: LogOut, any: ["LIFECYCLE_MANAGE"] },
  { href: "/hrm/leave?tab=holidays", label: "qa.holiday", icon: CalendarPlus, any: ["LEAVE_MANAGE"] },
  { href: "/hrm/issues?tab=warnings", label: "qa.warning", icon: AlertTriangle, any: ["LIFECYCLE_MANAGE"] },
]

export function HrmQuickActions() {
  const t = useT()
  const permissions = useAuthStore((s) => s.me?.permissions)
  const shown = HRM_ACTIONS.filter((a) => a.any.some((p) => permissions?.includes(p)))
  if (!shown.length) return null
  return (
    <Card data-testid="hrm-quick-actions">
      <CardHeader>
        <CardTitle>{t("qa.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {shown.map((a) => (
          <Button key={a.href} variant="outline" className="justify-start" asChild>
            <Link href={a.href}>
              <a.icon className="size-4" />
              {t(a.label)}
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}

/** Copies an absolute link of this app (public portal) to the clipboard. */
export function CopyLinkButton({ path, label, testId }: { path: string; label: TranslationKey; testId?: string }) {
  const t = useT()
  const [copied, setCopied] = React.useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard refused (insecure context): the link next to it stays usable
    }
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} data-testid={testId}>
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? t("qa.copied") : t(label)}
    </Button>
  )
}

/**
 * Support dashboard header actions: create ticket + the public portal link. The portal slug comes from the portal
 * settings (SUPPORT_SETTINGS_MANAGE); without that right or a portal, only "Create ticket" is shown.
 */
export function SupportQuickActions() {
  const t = useT()
  const permissions = useAuthStore((s) => s.me?.permissions)
  const canCreate = !!permissions?.some((p) => p === "SUPPORT_TICKET_MANAGE" || p === "SUPPORT_TICKET_MANAGE_OWN")
  const [slug, setSlug] = React.useState<string>()
  React.useEffect(() => {
    let cancelled = false
    SupportService.settings()
      .then((s) => !cancelled && s?.enabled && s.slug && setSlug(s.slug))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])
  if (!canCreate && !slug) return null
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="support-quick-actions">
      {canCreate && (
        <Button size="sm" asChild>
          <Link href="/support/tickets">
            <Plus className="size-4" />
            {t("qa.createTicket")}
          </Link>
        </Button>
      )}
      {slug && (
        <>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/help/${slug}`} target="_blank" rel="noopener">
              <ExternalLink className="size-4" />
              {t("qa.ticketPortal")}
            </Link>
          </Button>
          <CopyLinkButton path={`/help/${slug}`} label="qa.copyLink" testId="copy-help-link" />
        </>
      )}
    </div>
  )
}
