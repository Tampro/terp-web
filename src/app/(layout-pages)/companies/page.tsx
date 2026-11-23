"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpCircle, History, Info, KeyRound, LayoutGrid, List, LogIn, MoreHorizontal, Pencil, Plus, Power, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { RequireSuperAdmin } from "@/components/common/require-super-admin"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useUrlQuery } from "@/hooks/use-url-query"
import { actAsStore, type IPage } from "@/lib/api"
import {
  CompanyService,
  type CompanyDto,
  type ECompanyStatus,
  type StatusCountsDto,
} from "@/lib/admin/admin.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"

import { CompanyPasswordDialog, CreateCompanyDialog, EditCompanyDialog } from "./_components/company-form-dialog"
import { CompanyInfoDialog, UpgradePlanDialog } from "./_components/company-info-dialog"

const PAGE_SIZE = 20
type StatusTab = "ALL" | ECompanyStatus

export default function CompaniesPage() {
  return (
    <RequireSuperAdmin>
      <React.Suspense>
        <CompaniesList />
      </React.Suspense>
    </RequireSuperAdmin>
  )
}

/** §3.2 Users (companies). Filters live in the URL so back-navigation keeps them. */
function CompaniesList() {
  // Lib
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  // Query (URL = source of truth)
  const { searchParams, update: updateQuery, reset: resetQuery } = useUrlQuery()
  const keyword = searchParams.get("keyword") ?? ""
  const status = (searchParams.get("status") as StatusTab | null) ?? "ALL"
  const createdFrom = searchParams.get("createdFrom") ?? ""
  const createdTo = searchParams.get("createdTo") ?? ""
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)
  const view = searchParams.get("view") === "grid" ? "grid" : "list"

  // Data
  const [data, setData] = React.useState<IPage<CompanyDto>>()
  const [counts, setCounts] = React.useState<StatusCountsDto>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((k) => k + 1)

  React.useEffect(() => {
    let cancelled = false
    const filter = { keyword: keyword || undefined, createdFrom: createdFrom || undefined, createdTo: createdTo || undefined }
    Promise.all([
      CompanyService.list({ ...filter, status: status === "ALL" ? undefined : status, page, size: PAGE_SIZE }),
      CompanyService.statusCounts(filter),
    ])
      .then(([list, c]) => {
        if (cancelled) return
        setData(list)
        setCounts(c)
      })
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [keyword, status, createdFrom, createdTo, page, reloadKey])

  // Search box: applied on Enter / button so each keystroke doesn't hit the API
  const [search, setSearch] = React.useState(keyword)

  // Dialogs
  const [creating, setCreating] = React.useState(false)
  const [editing, setEditing] = React.useState<CompanyDto>()
  const [password, setPassword] = React.useState<CompanyDto>()
  const [deleting, setDeleting] = React.useState<CompanyDto>()
  const [viewing, setViewing] = React.useState<CompanyDto>()
  const [upgrading, setUpgrading] = React.useState<CompanyDto>()

  const actions = (c: CompanyDto) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("companies.actionsFor", { name: c.name ?? "" })}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setViewing(c)}>
          <Info className="size-4" /> {t("companies.info")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={c.status !== "ACTIVE"} onClick={() => loginAs(c)}>
          <LogIn className="size-4" /> {t("companies.loginAs")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setUpgrading(c)}>
          <ArrowUpCircle className="size-4" /> {t("companies.upgradePlan")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setPassword(c)}>
          <KeyRound className="size-4" /> {t("companies.changePassword")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setEditing(c)}>
          <Pencil className="size-4" /> {t("common.edit")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleStatus(c)}>
          <Power className="size-4" />
          {c.status === "ACTIVE" ? t("companies.disableLogin") : t("companies.enableLogin")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => setDeleting(c)}>
          <Trash2 className="size-4" /> {t("common.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
  const statusBadge = (c: CompanyDto) => (
    <Badge variant={c.status === "ACTIVE" ? "secondary" : "outline"}>
      {c.status === "ACTIVE" ? t("companies.enabled") : c.status ? t("companies.disabled") : "-"}
    </Badge>
  )

  async function toggleStatus(c: CompanyDto) {
    if (!c.id) return
    const next: ECompanyStatus = c.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
    try {
      await CompanyService.setStatus(c.id, next)
      toast.success(next === "ACTIVE" ? t("companies.loginEnabledToast") : t("companies.loginDisabledToast"))
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  async function loginAs(c: CompanyDto) {
    if (!c.id) return
    try {
      const s = await CompanyService.startImpersonation(c.id)
      if (!s?.sessionKey) return
      actAsStore.set({ sessionKey: s.sessionKey, companyId: s.companyId, companyName: s.companyName ?? c.name, expiresAt: s.expiresAt })
      // Full reload: every store (me, profile, menus) must be fetched again as the company administrator.
      window.location.assign("/dashboard")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const rows = data?.content ?? []
  const tabs: { value: StatusTab; label: string; count?: number }[] = [
    { value: "ALL", label: t("companies.tabAll"), count: counts?.all },
    { value: "ACTIVE", label: t("companies.enabled"), count: counts?.active },
    { value: "SUSPENDED", label: t("companies.disabled"), count: counts?.inactive },
  ]

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("companies.title")} description={t("companies.subtitle")}>
        <Button variant="outline" asChild>
          <Link href="/companies/login-history">
            <History className="size-4" /> {t("loginHistory.title")}
          </Link>
        </Button>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> {t("companies.create")}
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={status} onValueChange={(v) => updateQuery({ status: v, page: 0 })}>
              <TabsList>
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                    {tab.count !== undefined && <span className="text-muted-foreground ml-1 text-xs">({tab.count})</span>}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <form
              className="flex min-w-60 flex-1 items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                updateQuery({ keyword: search.trim(), page: 0 })
              }}
            >
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("companies.searchPlaceholder")}
                  aria-label={t("common.search")}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="secondary">
                {t("common.search")}
              </Button>
            </form>
            <div className="flex items-center gap-2 text-sm">
              <Input
                type="date"
                className="w-40"
                aria-label={t("companies.createdFrom")}
                value={createdFrom}
                onChange={(e) => updateQuery({ createdFrom: e.target.value, page: 0 })}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="date"
                className="w-40"
                aria-label={t("companies.createdTo")}
                value={createdTo}
                onChange={(e) => updateQuery({ createdTo: e.target.value, page: 0 })}
              />
            </div>
            <div className="flex rounded-md border p-0.5" role="group" aria-label={t("companies.view")}>
              <Button size="icon" variant={view === "list" ? "secondary" : "ghost"} className="size-8" aria-label={t("companies.viewList")} aria-pressed={view === "list"} onClick={() => updateQuery({ view: "" })}>
                <List className="size-4" />
              </Button>
              <Button size="icon" variant={view === "grid" ? "secondary" : "ghost"} className="size-8" aria-label={t("companies.viewGrid")} aria-pressed={view === "grid"} onClick={() => updateQuery({ view: "grid" })}>
                <LayoutGrid className="size-4" />
              </Button>
            </div>
            {(keyword || createdFrom || createdTo || status !== "ALL") && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch("")
                  resetQuery()
                }}
              >
                {t("common.reset")}
              </Button>
            )}
          </div>

          {view === "grid" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="companies-grid">
              {loading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
              {!loading && rows.length === 0 && <p className="text-muted-foreground col-span-full py-8 text-center">{t("companies.empty")}</p>}
              {!loading &&
                rows.map((c) => (
                  <div key={c.id} className="flex flex-col gap-3 rounded-lg border p-4">
                    <div className="flex items-start gap-3">
                      <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full font-semibold">{(c.name ?? "?").charAt(0).toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.name ?? "-"}</p>
                        <p className="text-muted-foreground truncate text-xs">{c.email ?? "-"}</p>
                      </div>
                      {actions(c)}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span>
                        {c.planName ?? "-"}
                        {c.planExpiresAt && <span className="text-muted-foreground"> · {t("companies.expires", { date: formatDate(c.planExpiresAt, language) })}</span>}
                      </span>
                      {statusBadge(c)}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {c.code} · {formatDate(c.createdDate, language)}
                    </p>
                  </div>
                ))}
            </div>
          ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("companies.name")}</TableHead>
                  <TableHead>{t("companies.email")}</TableHead>
                  <TableHead>{t("companies.plan")}</TableHead>
                  <TableHead>{t("companies.loginStatus")}</TableHead>
                  <TableHead>{t("companies.createdAt")}</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{t("common.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                      {t("companies.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.name ?? "-"}</div>
                        <div className="text-muted-foreground text-xs">{c.code ?? "-"}</div>
                      </TableCell>
                      <TableCell>{c.email ?? "-"}</TableCell>
                      <TableCell>
                        <div>{c.planName ?? "-"}</div>
                        {c.planExpiresAt && (
                          <div className="text-muted-foreground text-xs">
                            {t("companies.expires", { date: formatDate(c.planExpiresAt, language) })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{statusBadge(c)}</TableCell>
                      <TableCell>{formatDate(c.createdDate, language)}</TableCell>
                      <TableCell>{actions(c)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          )}

          <Pager
            page={data?.page ?? page}
            size={data?.size ?? PAGE_SIZE}
            total={data?.totalElements ?? 0}
            totalPages={data?.totalPages ?? 0}
            onPage={(p) => updateQuery({ page: p })}
          />
        </CardContent>
      </Card>

      <CreateCompanyDialog open={creating} onOpenChange={setCreating} onCreated={reload} />
      <EditCompanyDialog company={editing} onOpenChange={(o) => !o && setEditing(undefined)} onSaved={reload} />
      <CompanyPasswordDialog company={password} onOpenChange={(o) => !o && setPassword(undefined)} />
      <CompanyInfoDialog company={viewing} onOpenChange={(o) => !o && setViewing(undefined)} />
      <UpgradePlanDialog company={upgrading} onOpenChange={(o) => !o && setUpgrading(undefined)} onDone={reload} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("companies.deleteTitle", { name: deleting?.name ?? "" })}
        description={t("companies.deleteDesc")}
        onConfirm={async () => {
          if (!deleting?.id) return
          try {
            await CompanyService.remove(deleting.id)
            toast.success(t("companies.deleted"))
            reload()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
          }
        }}
      />
    </div>
  )
}
