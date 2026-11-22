"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Copy, Eye, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Pager } from "@/components/common/pager"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useMoney } from "@/hooks/use-money"
import { useUrlQuery } from "@/hooks/use-url-query"
import type { IPage } from "@/lib/api"
import { useAuthStore } from "@/lib/auth/auth.store"
import {
  ContractService,
  ContractTypeService,
  type ContractCounts,
  type ContractDetail,
  type ContractRow,
  type ContractSettingDto,
  type ContractTypeDto,
  type EContractStatus,
} from "@/lib/crm/crm.service"
import { formatDate, formatNumber } from "@/lib/format"
import { SalesLookupService, type CustomerOption } from "@/lib/sales/sales.service"
import { useLanguageStore, useT, type TranslationKey } from "@/lib/i18n"

import { CONTRACT_STATUSES, ContractFormDialog } from "../_components/contract-form-dialog"
import { attempt, ContractStatusBadge, errorMessage } from "../_components/crm-kit"

const PAGE_SIZE = 20
const ALL = "ALL"

/** §7.5 Contracts: status cards, filters (type, status, customer, dates), duration progress; duplicate, view, edit, delete. */
export default function ContractsPage() {
  return (
    <React.Suspense>
      <Contracts />
    </React.Suspense>
  )
}

function Contracts() {
  const t = useT()
  const money = useMoney()
  const router = useRouter()
  const language = useLanguageStore((s) => s.language)
  const manage = !!useAuthStore((s) => s.me?.permissions)?.includes("CRM_CONTRACT_MANAGE")
  const { searchParams, update } = useUrlQuery()
  const keyword = searchParams.get("keyword") ?? ""
  const status = (searchParams.get("status") as EContractStatus | null) ?? undefined
  const contractTypeId = searchParams.get("typeId") ?? undefined
  const customerId = searchParams.get("customerId") ?? undefined
  const startFrom = searchParams.get("startFrom") ?? undefined
  const endTo = searchParams.get("endTo") ?? undefined
  const page = Math.max(0, Number(searchParams.get("page") ?? 0) || 0)

  const [data, setData] = React.useState<IPage<ContractRow>>()
  const [counts, setCounts] = React.useState<ContractCounts>()
  const [types, setTypes] = React.useState<ContractTypeDto[]>([])
  const [customers, setCustomers] = React.useState<CustomerOption[]>([])
  const [setting, setSetting] = React.useState<ContractSettingDto>()
  const [loading, setLoading] = React.useState(true)
  const [reloadKey, setReloadKey] = React.useState(0)
  const reload = () => setReloadKey((x) => x + 1)
  const [search, setSearch] = React.useState(keyword)
  const [editing, setEditing] = React.useState<{ detail?: ContractDetail } | null>(null)
  const [pending, setPending] = React.useState<{ action: "delete" | "duplicate"; row: ContractRow }>()

  React.useEffect(() => {
    let cancelled = false
    Promise.all([
      ContractTypeService.list().catch(() => []),
      SalesLookupService.customers().then((r) => r.content ?? []).catch((e: Error) => (toast.error(e.message), [])),
    ]).then(([ty, cu]) => !cancelled && (setTypes(ty), setCustomers(cu)))
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    Promise.all([
      ContractService.list({ keyword: keyword || undefined, status, contractTypeId, customerId, startFrom, endTo, page, size: PAGE_SIZE }),
      ContractService.counts(),
      ContractTypeService.settings().catch(() => undefined),
    ])
      .then(([list, c, s]) => !cancelled && (setData(list), setCounts(c), setSetting(s)))
      .catch((e: Error) => !cancelled && toast.error(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [keyword, status, contractTypeId, customerId, startFrom, endTo, page, reloadKey])

  async function openEdit(row: ContractRow) {
    try {
      setEditing({ detail: await ContractService.get(row.id!) })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const typeName = (id?: string) => types.find((x) => x.id === id)?.name ?? "-"
  const rows = data?.content ?? []
  const cards: { key: keyof ContractCounts; status?: EContractStatus; label: TranslationKey }[] = [
    { key: "total", label: "crm.contract.total" },
    { key: "active", status: "ACTIVE", label: "crm.contractStatus.ACTIVE" },
    { key: "pending", status: "PENDING", label: "crm.contractStatus.PENDING" },
    { key: "closed", status: "CLOSED", label: "crm.contractStatus.CLOSED" },
    { key: "declined", status: "DECLINED", label: "crm.contractStatus.DECLINED" },
  ]

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <PageHeader title={t("menu.crm.contracts")} description={t("crm.contract.subtitle")}>
        {manage && (
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> {t("crm.contract.create")}
          </Button>
        )}
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            className="text-left"
            aria-pressed={status === c.status}
            onClick={() => update({ status: c.status ?? "", page: 0 })}
          >
            <Card className={status === c.status ? "ring-primary ring-2" : undefined}>
              <CardHeader>
                <CardDescription>{t(c.label)}</CardDescription>
                <CardTitle className="text-2xl">{counts ? formatNumber(counts[c.key], language) : "-"}</CardTitle>
              </CardHeader>
            </Card>
          </button>
        ))}
      </div>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <Select value={contractTypeId ?? ALL} onValueChange={(v) => update({ typeId: v === ALL ? "" : v, page: 0 })}>
              <SelectTrigger className="w-44" aria-label={t("crm.contract.type")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("crm.contract.allTypes")}</SelectItem>
                {types.map((x) => (
                  <SelectItem key={x.id} value={x.id ?? ""}>
                    {x.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status ?? ALL} onValueChange={(v) => update({ status: v === ALL ? "" : v, page: 0 })}>
              <SelectTrigger className="w-40" aria-label={t("crm.status")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("crm.allStatuses")}</SelectItem>
                {CONTRACT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`crm.contractStatus.${s}` as TranslationKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={customerId ?? ALL} onValueChange={(v) => update({ customerId: v === ALL ? "" : v, page: 0 })}>
              <SelectTrigger className="w-48" aria-label={t("crm.client")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("crm.allClients")}</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id ?? ""}>
                    {c.companyName ?? c.customerCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="w-40"
              aria-label={t("crm.contract.startFrom")}
              value={startFrom ?? ""}
              onChange={(e) => update({ startFrom: e.target.value, page: 0 })}
            />
            <Input
              type="date"
              className="w-40"
              aria-label={t("crm.contract.endTo")}
              value={endTo ?? ""}
              onChange={(e) => update({ endTo: e.target.value, page: 0 })}
            />
            <form
              className="flex min-w-60 flex-1 items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                update({ keyword: search.trim(), page: 0 })
              }}
            >
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("crm.contract.searchPlaceholder")}
                  aria-label={t("common.search")}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="secondary">
                {t("common.search")}
              </Button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("crm.contract.number")}</TableHead>
                  <TableHead>{t("crm.subject")}</TableHead>
                  <TableHead>{t("crm.client")}</TableHead>
                  <TableHead>{t("crm.contract.type")}</TableHead>
                  <TableHead className="text-right">{t("crm.value")}</TableHead>
                  <TableHead>{t("crm.contract.duration")}</TableHead>
                  <TableHead>{t("crm.status")}</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{t("common.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground h-24 text-center">
                      {t("crm.contract.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs font-medium">
                        <Link href={`/crm/contracts/${row.id}`} className="hover:underline">
                          {row.number ?? "-"}
                        </Link>
                      </TableCell>
                      <TableCell>{row.subject}</TableCell>
                      <TableCell>{row.customerName ?? customers.find((c) => c.id === row.customerId)?.companyName ?? "-"}</TableCell>
                      <TableCell>{typeName(row.contractTypeId)}</TableCell>
                      <TableCell className="text-right">{row.value === null || row.value === undefined ? "-" : money(row.value)}</TableCell>
                      <TableCell className="min-w-44">
                        <div className="text-muted-foreground text-xs">
                          {formatDate(row.startDate, language)} – {formatDate(row.endDate, language)}
                        </div>
                        <Progress value={row.progressPercent ?? 0} className="mt-1 h-1.5" aria-label={t("crm.contract.duration")} />
                        <div className="text-muted-foreground mt-0.5 text-xs">
                          {(row.daysLeft ?? 0) > 0 ? t("crm.contract.daysLeft", { n: row.daysLeft ?? 0 }) : t("crm.contract.ended")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ContractStatusBadge status={row.status} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={t("crm.actionsFor", { name: row.number ?? "" })}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/crm/contracts/${row.id}`)}>
                              <Eye className="size-4" /> {t("crm.action.view")}
                            </DropdownMenuItem>
                            {manage && (
                              <>
                                <DropdownMenuItem onClick={() => openEdit(row)}>
                                  <Pencil className="size-4" /> {t("common.edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setPending({ action: "duplicate", row })}>
                                  <Copy className="size-4" /> {t("crm.action.duplicate")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setPending({ action: "delete", row })}>
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
          <Pager
            page={data?.page ?? page}
            size={data?.size ?? PAGE_SIZE}
            total={data?.totalElements ?? 0}
            totalPages={data?.totalPages ?? 0}
            onPage={(p) => update({ page: p })}
          />
        </CardContent>
      </Card>

      <ContractFormDialog
        state={editing}
        customers={customers}
        types={types}
        nextNumber={setting?.nextContractNumber}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(undefined)}
        title={t(pending?.action === "duplicate" ? "crm.confirm.duplicateContract" : "crm.confirm.deleteContract", {
          number: pending?.row.number ?? "",
        })}
        description={t(pending?.action === "duplicate" ? "crm.confirm.duplicateDesc" : "crm.confirm.deleteDesc")}
        confirmLabel={t(pending?.action === "duplicate" ? "crm.action.duplicate" : "common.delete")}
        onConfirm={async () => {
          if (!pending?.row.id) return
          const id = pending.row.id
          const ok =
            pending.action === "duplicate"
              ? await attempt(() => ContractService.duplicate(id), t("crm.done.duplicated"))
              : await attempt(() => ContractService.remove(id), t("crm.done.deleted"))
          if (ok) reload()
        }}
      />
    </div>
  )
}
