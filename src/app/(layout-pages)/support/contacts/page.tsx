"use client"

import * as React from "react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Row } from "@/lib/hrm/hrm.service"
import { SUP } from "@/lib/support/support.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"

import { CrudSection, TabbedPage, useAuthStore, type CrudConfig } from "../../hrm/_components/crud-kit"

export default function ContactsPage() {
  return (
    <React.Suspense>
      <Contacts />
    </React.Suspense>
  )
}

/** §18 contact messages sent from the support portal: view, delete. */
function Contacts() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("SUPPORT_CONTACT_MANAGE")
  const [viewing, setViewing] = React.useState<Row>()
  const cfg: CrudConfig = {
    id: "contacts",
    load: SUP.contacts.list,
    keyword: true,
    onRowClick: setViewing,
    columns: [
      { label: "sp.subject", path: "subject" },
      { label: "hr.f.name", path: "name" },
      { label: "hr.f.email", path: "email" },
      { label: "sp.message", render: (r) => <span className="line-clamp-1 max-w-80">{String(r.message ?? "")}</span> },
      { label: "sp.received", path: "createdDate", kind: "date" },
    ],
    rowName: (r) => String(r.subject ?? ""),
    remove: SUP.contacts.remove,
    manage,
  }
  return (
    <>
      <TabbedPage title={t("menu.sp.contacts")} description={t("sp.contacts.subtitle")} tabs={[{ key: "list", label: "menu.sp.contacts", content: () => <CrudSection config={cfg} /> }]} />
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(undefined)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{String(viewing?.subject ?? "")}</DialogTitle>
            <DialogDescription>
              {String(viewing?.name ?? "")} · {String(viewing?.email ?? "")} · {formatDate(String(viewing?.createdDate ?? ""), language)}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm whitespace-pre-wrap">{String(viewing?.message ?? "")}</p>
        </DialogContent>
      </Dialog>
    </>
  )
}
