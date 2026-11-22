"use client"

import * as React from "react"

import {
  CrmSetupService,
  CrmUserService,
  type CrmUserOption,
  type LabelDto,
  type PipelineDto,
  type SourceDto,
} from "@/lib/crm/crm.service"
import { SalesLookupService, type CustomerOption, type ItemOption } from "@/lib/sales/sales.service"

export interface CrmLookups {
  pipelines: PipelineDto[]
  labels: LabelDto[]
  sources: SourceDto[]
  users: CrmUserOption[]
  customers: CustomerOption[]
  items: ItemOption[]
  loading: boolean
  /** first failure (e.g. COMMON_004 without IAM_USER_VIEW / CUSTOMER_VIEW / INVENTORY_VIEW) */
  error?: string
  reload: () => void
}

/**
 * Setup lists (crm-service), company accounts (IAM), customers (accounting) and items (inventory) for CRM screens.
 * TODO(assumption): the first 100 users / 50 customers / 50 items are enough until a searchable picker is needed.
 */
export function useCrmLookups(): CrmLookups {
  const [key, setKey] = React.useState(0)
  const [state, setState] = React.useState<Omit<CrmLookups, "reload">>({
    pipelines: [],
    labels: [],
    sources: [],
    users: [],
    customers: [],
    items: [],
    loading: true,
  })
  React.useEffect(() => {
    let cancelled = false
    const errors: string[] = []
    const safe = <T,>(p: Promise<T>, empty: T) => p.catch((e: Error) => (errors.push(e.message), empty))
    Promise.all([
      safe(CrmSetupService.pipelines(), []),
      safe(CrmSetupService.labels(), []),
      safe(CrmSetupService.sources(), []),
      safe(CrmUserService.users().then((r) => r.content ?? []), []),
      safe(SalesLookupService.customers().then((r) => r.content ?? []), []),
      safe(SalesLookupService.items().then((r) => r.content ?? []), []),
    ]).then(([pipelines, labels, sources, users, customers, items]) => {
      if (!cancelled) setState({ pipelines, labels, sources, users, customers, items, loading: false, error: errors[0] })
    })
    return () => {
      cancelled = true
    }
  }, [key])
  const reload = React.useCallback(() => setKey((x) => x + 1), [])
  return { ...state, reload }
}

export const userName = (users: CrmUserOption[], id?: string | null) => {
  if (!id) return "-"
  const u = users.find((x) => x.id === id)
  return u ? (u.fullName || u.username || `#${id}`) : `#${id}`
}
