"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Copy, Inbox, Link2, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { useAuthStore } from "@/lib/auth/auth.store"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"
import { FormService, type FormDto, type FormRow } from "@/lib/project/project.service"

import { attempt, errorMessage } from "../projects/_components/project-kit"
import { FormBuilderDialog } from "./_components/form-builder-dialog"

const PAGE_SIZE = 20
const publicUrl = (token?: string) => (token ? `${window.location.origin}/f/${token}` : "")

export default function FormsPage() {
  return (
    <React.Suspense>
      <Forms />
    </React.Suspense>
  )
}

/** §11.2 Forms: name, active, layout, public link (copy / regenerate), responses, edit in the builder. */
function Forms() {
  const t = useT()
  const router = useRouter()
  const language = useLanguageStore((s) => s.language)
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("FORM_MANAGE")
  const { searchParams, update } = useUrlQuery()
  const keyword = searchParams.get("keyword") ?? ""
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const [data, setData] = React.useState<IPage<FormRow>>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [search, setSearch] = React.useState(keyword)
  const [editing, setEditing] = React.useState<{ form?: FormDto } | null>(null)
  const [pending, setPending] = React.useState<{ action: "delete" | "regenerate"; row: FormRow }>()

  React.useEffect(() => {
    let cancelled = false
    FormService.list({ keyword: keyword || undefined, page, size: PAGE_SIZE })
      .then((p) => !cancelled && setData(p))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [keyword, page, reloadKey])

  async function copyLink(row: FormRow) {
    try {
      await navigator.clipboard.writeText(publicUrl(row.publicToken))
      toast.success(t("form.linkCopied"))
    } catch {
      toast.message(publicUrl(row.publicToken))
    }
  }
  async function openEdit(row: FormRow) {
    try {
      setEditing({ form: await FormService.get(row.id!) })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const rows = data?.content ?? []
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.forms")} description={t("form.subtitle")}>
        {manage && (
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> {t("form.create")}
          </Button>
        )}
      </PageHeader>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              update({ keyword: search.trim(), page: 0 })
            }}
          >
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("form.searchPlaceholder")} aria-label={t("common.search")} className="pl-9" />
            </div>
            <Button type="submit" variant="secondary">
              {t("common.search")}
            </Button>
          </form>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("crm.name")}</TableHead>
                  <TableHead>{t("form.layout")}</TableHead>
                  <TableHead>{t("crm.status")}</TableHead>
                  <TableHead>{t("crm.created")}</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{t("common.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                      {t("form.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.layout ? t(`form.layoutOf.${r.layout}` as TranslationKey) : "-"}</TableCell>
                      <TableCell>
                        <Badge variant={r.active ? "default" : "outline"}>{t(r.active ? "crm.active" : "crm.inactive")}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(r.createdDate, language)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={t("crm.actionsFor", { name: r.name ?? "" })}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/forms/${r.id}`)}>
                              <Inbox className="size-4" /> {t("form.responses")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyLink(r)}>
                              <Copy className="size-4" /> {t("form.copyLink")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.open(publicUrl(r.publicToken), "_blank", "noopener")}>
                              <Link2 className="size-4" /> {t("form.openLink")}
                            </DropdownMenuItem>
                            {manage && (
                              <>
                                <DropdownMenuItem onClick={() => openEdit(r)}>
                                  <Pencil className="size-4" /> {t("common.edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setPending({ action: "regenerate", row: r })}>
                                  <RefreshCw className="size-4" /> {t("form.regenerate")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setPending({ action: "delete", row: r })}>
                                  <Trash2 className="size-4" /> {t("common.delete")}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <Pager page={data?.page ?? page} size={data?.size ?? PAGE_SIZE} total={data?.totalElements ?? 0} totalPages={data?.totalPages ?? 0} onPage={(p) => update({ page: p })} />
        </CardContent>
      </Card>

      <FormBuilderDialog state={editing} onClose={() => setEditing(null)} onSaved={reload} />
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(undefined)}
        title={t(pending?.action === "regenerate" ? "form.confirm.regenerate" : "form.confirm.delete", { name: pending?.row.name ?? "" })}
        description={t(pending?.action === "regenerate" ? "form.confirm.regenerateDesc" : "crm.confirm.deleteDesc")}
        confirmLabel={t(pending?.action === "regenerate" ? "form.regenerate" : "common.delete")}
        onConfirm={async () => {
          if (!pending?.row.id) return
          const id = pending.row.id
          const ok =
            pending.action === "regenerate"
              ? await attempt(() => FormService.regenerateToken(id), t("form.done.regenerated"))
              : await attempt(() => FormService.remove(id), t("crm.done.deleted"))
          if (ok) reload()
        }}
      />
    </div>
  )
}
