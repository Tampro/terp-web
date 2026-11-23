"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { PageHeader } from "@/components/common/page-header"
import { RequireSuperAdmin } from "@/components/common/require-super-admin"
import { EmailTemplateService } from "@/lib/email-template/email-template.service"
import { useT } from "@/lib/i18n"

import { CrudSection, type CrudConfig } from "../hrm/_components/crud-kit"

export default function EmailTemplatesPage() {
  return (
    <RequireSuperAdmin>
      <React.Suspense>
        <EmailTemplates />
      </React.Suspense>
    </RequireSuperAdmin>
  )
}

/** §3.5 email templates (super admin): the fixed list of system emails; edit only, no create or delete. */
function EmailTemplates() {
  const t = useT()
  const router = useRouter()
  const cfg: CrudConfig = {
    id: "email-templates",
    load: EmailTemplateService.list as CrudConfig["load"],
    keyword: true,
    manage: false,
    rowName: (r) => String(r.name ?? ""),
    onRowClick: (r) => router.push(`/email-templates/${r.id}`),
    columns: [
      { label: "et.name", path: "name" },
      { label: "et.code", path: "code", kind: "mono" },
      { label: "et.fromName", path: "fromName", kind: "mono" },
      { label: "et.updated", path: "updatedDate", kind: "date" },
    ],
  }
  return (
    <div className="grid gap-4">
      <PageHeader title={t("menu.emailTemplates")} description={t("et.subtitle")} />
      <CrudSection config={cfg} />
    </div>
  )
}

