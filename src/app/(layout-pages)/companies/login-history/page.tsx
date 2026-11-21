"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { RequireSuperAdmin } from "@/components/common/require-super-admin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { LoginHistoryService, type EUserType, type LoginDto } from "@/lib/admin/admin.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"

const PAGE_SIZE = 20

export default function LoginHistoryPage() {
  return (
    <RequireSuperAdmin>
      <React.Suspense>
        <LoginHistoryList />
      </React.Suspense>
    </RequireSuperAdmin>
  )
}

/**
 * §3.2 Login History — GET /iam/login-history (super admin: every login; keyword = username or IP).
 * The backend records IP, browser, OS and user agent; location/ISP/timezone from the manual are not collected.
 */
function LoginHistoryList() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const { searchParams, update: updateQuery } = useUrlQuery()
  const keyword = searchParams.get("keyword") ?? ""
  const userType = (searchParams.get("userType") as EUserType | null) ?? undefined
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)

  const [data, setData] = React.useState<IPage<LoginDto>>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [search, setSearch] = React.useState(keyword)
  const [deleting, setDeleting] = React.useState<LoginDto>()

  React.useEffect(() => {
    let cancelled = false
    LoginHistoryService.list({ keyword: keyword || undefined, userType, page, size: PAGE_SIZE })
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [keyword, userType, page, reloadKey])

  const rows = data?.content ?? []

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("loginHistory.title")} description={t("loginHistory.subtitle")}>
        <Button variant="outline" asChild>
          <Link href="/companies">
            <ArrowLeft className="size-4" /> {t("companies.title")}
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
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
                  placeholder={t("loginHistory.searchPlaceholder")}
                  aria-label={t("common.search")}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="secondary">
                {t("common.search")}
              </Button>
            </form>
            <Select value={userType ?? "ALL"} onValueChange={(v) => updateQuery({ userType: v, page: 0 })}>
              <SelectTrigger className="w-48" aria-label={t("loginHistory.userType")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("loginHistory.allUsers")}</SelectItem>
                <SelectItem value="SUPER_ADMIN">{t("loginHistory.superAdmin")}</SelectItem>
                <SelectItem value="COMPANY_USER">{t("loginHistory.companyUser")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("loginHistory.user")}</TableHead>
                  <TableHead>{t("loginHistory.userType")}</TableHead>
                  <TableHead>{t("loginHistory.ip")}</TableHead>
                  <TableHead>{t("loginHistory.device")}</TableHead>
                  <TableHead>{t("loginHistory.time")}</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{t("common.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                      {t("common.noData")}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.username ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {r.userType === "SUPER_ADMIN"
                            ? t("loginHistory.superAdmin")
                            : r.userType
                              ? t("loginHistory.companyUser")
                              : "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.ipAddress ?? "-"}</TableCell>
                      <TableCell title={r.userAgent ?? undefined}>
                        {[r.browser, r.os].filter(Boolean).join(" · ") || "-"}
                      </TableCell>
                      <TableCell>{formatDate(r.loginAt, language, true)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("loginHistory.deleteRow", { user: r.username ?? "" })}
                          onClick={() => setDeleting(r)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <Pager
            page={data?.page ?? page}
            size={data?.size ?? PAGE_SIZE}
            total={data?.totalElements ?? 0}
            totalPages={data?.totalPages ?? 0}
            onPage={(p) => updateQuery({ page: p })}
          />
        </CardContent>
      </Card>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={t("loginHistory.deleteTitle")}
        onConfirm={async () => {
          if (!deleting?.id) return
          try {
            await LoginHistoryService.remove(deleting.id)
            setReloadKey((k) => k + 1)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
          }
        }}
      />
    </div>
  )
}
