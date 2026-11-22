"use client"

import * as React from "react"
import { Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { htmlToText, SUP, SupportService } from "@/lib/support/support.service"
import { useT } from "@/lib/i18n"

import { CrudSection, errorMessage, pick, TabbedPage, useAuthStore, useOptions, type CrudConfig } from "../../hrm/_components/crud-kit"


export default function KnowledgePage() {
  return (
    <React.Suspense>
      <Knowledge />
    </React.Suspense>
  )
}

/** §18 knowledge base (articles + categories) and FAQ: CRUD and CSV import (headers `title,description,category,content` / `title,description`). */
function Knowledge() {
  const t = useT()
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("SUPPORT_KB_MANAGE")
  const categories = useOptions("sup:kb-categories", SupportService.kbCategories)
  const [reload, setReload] = React.useState(0)
  const [result, setResult] = React.useState<{ rows?: number; created?: number; errors?: { row?: number; message?: string }[] }>()
  const importButton = (kind: "kb" | "faqs") =>
    manage ? (
      <label className="hover:bg-accent inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
        <Upload className="size-4" /> {t("sp.importCsv")}
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          aria-label={t(kind === "kb" ? "sp.importKb" : "sp.importFaq")}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (!file) return
            try {
              setResult(await SupportService.importCsv(kind, file))
              setReload((x) => x + 1)
            } catch (err) {
              toast.error(errorMessage(err))
            }
          }}
        />
      </label>
    ) : undefined
  const articles: CrudConfig = {
    id: "kb",
    load: SUP.kb.list,
    keyword: true,
    reloadKey: reload,
    columns: [
      { label: "hr.f.title", path: "title" },
      { label: "hr.f.category", path: "categoryTitle" },
      { label: "hr.f.description", render: (r) => <span className="line-clamp-2 max-w-80">{String(r.description ?? "")}</span> },
      { label: "sp.published", path: "published", kind: "bool" },
      { label: "sp.updated", path: "updatedDate", kind: "date" },
    ],
    rowName: (r) => String(r.title ?? ""),
    createLabel: "sp.article.create",
    fields: [
      { name: "title", label: "hr.f.title", required: true, max: 255, full: true },
      { name: "categoryId", label: "hr.f.category", type: "select", required: true, numeric: true, options: categories.map((c) => ({ value: String(c.id), label: String(c.name) })) },
      { name: "published", label: "sp.published", type: "switch" },
      { name: "description", label: "sp.summary", required: true, max: 500, full: true },
      { name: "content", label: "rc.content", type: "textarea", max: 200000 },
    ],
    defaults: { published: true },
    fetchRow: async (r) => {
      const d = await SUP.kb.get(r.id ?? "")
      return { ...(d.article as object), content: d.content }
    },
    toValues: (r) => ({ ...r, categoryId: r.categoryId ?? pick(r, "category.id") }),
    save: SUP.kb.save,
    remove: SUP.kb.remove,
    manage,
    toolbar: importButton("kb"),
  }
  const kbCategories: CrudConfig = {
    id: "kb-categories",
    load: () => SupportService.kbCategories(),
    columns: [{ label: "hr.f.title", path: "title" }],
    rowName: (r) => String(r.title ?? ""),
    createLabel: "hr.category.create",
    fields: [{ name: "title", label: "hr.f.title", required: true, max: 255 }],
    save: SUP.kbCategories.save,
    remove: SUP.kbCategories.remove,
    invalidates: true,
    manage,
  }
  const faqs: CrudConfig = {
    id: "faqs",
    load: SUP.faqs.list,
    keyword: true,
    reloadKey: reload,
    columns: [
      { label: "sp.question", path: "title" },
      { label: "sp.answer", render: (r) => <span className="line-clamp-2 max-w-96">{htmlToText(String(r.description ?? ""))}</span> },
      { label: "sp.published", path: "published", kind: "bool" },
    ],
    rowName: (r) => String(r.title ?? ""),
    createLabel: "sp.faq.create",
    fields: [
      { name: "title", label: "sp.question", required: true, max: 255, full: true },
      { name: "description", label: "sp.answer", type: "textarea", required: true, max: 100000 },
      { name: "published", label: "sp.published", type: "switch" },
    ],
    defaults: { published: true },
    toValues: (r) => ({ ...r, description: htmlToText(String(r.description ?? "")) }),
    save: SUP.faqs.save,
    remove: SUP.faqs.remove,
    manage,
    toolbar: importButton("faqs"),
  }
  return (
    <>
      <TabbedPage
        title={t("menu.sp.knowledge")}
        description={t("sp.knowledge.subtitle")}
        tabs={[
          { key: "articles", label: "sp.articles", content: () => <CrudSection config={articles} /> },
          { key: "categories", label: "hr.categories", content: () => <CrudSection config={kbCategories} /> },
          { key: "faqs", label: "sp.faqs", content: () => <CrudSection config={faqs} /> },
        ]}
      />
      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(undefined)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("sp.importResult")}</DialogTitle>
            <DialogDescription>{t("sp.importSummary", { created: result?.created ?? 0, rows: result?.rows ?? 0 })}</DialogDescription>
          </DialogHeader>
          {!!result?.errors?.length && (
            <ul className="text-destructive grid gap-1 text-sm" data-testid="import-errors">
              {result.errors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          )}
          <Button onClick={() => setResult(undefined)}>{t("common.cancel")}</Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
