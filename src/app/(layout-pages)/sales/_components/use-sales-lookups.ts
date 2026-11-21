"use client"

import * as React from "react"

import {
  SalesLookupService,
  type CustomerOption,
  type ItemOption,
  type WarehouseOption,
} from "@/lib/sales/sales.service"

export interface SalesLookups {
  customers: CustomerOption[]
  items: ItemOption[]
  warehouses: WarehouseOption[]
  loading: boolean
  /** first failure (e.g. COMMON_004 without CUSTOMER_VIEW / INVENTORY_VIEW) */
  error?: string
}

/**
 * Customers (accounting-service), items and active warehouses (inventory-service) for the filters and forms.
 * TODO(assumption): the first 50 customers / items are enough until a searchable picker is needed.
 */
export function useSalesLookups(enabled = true): SalesLookups {
  const [state, setState] = React.useState<SalesLookups>({ customers: [], items: [], warehouses: [], loading: true })
  React.useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const errors: string[] = []
    const safe = <T,>(p: Promise<{ content?: T[] }>) =>
      p.then((r) => r.content ?? []).catch((e: Error) => (errors.push(e.message), [] as T[]))
    Promise.all([
      safe<CustomerOption>(SalesLookupService.customers()),
      safe<ItemOption>(SalesLookupService.items()),
      safe<WarehouseOption>(SalesLookupService.warehouses()),
    ]).then(([customers, items, warehouses]) => {
      if (!cancelled) setState({ customers, items, warehouses, loading: false, error: errors[0] })
    })
    return () => {
      cancelled = true
    }
  }, [enabled])
  return state
}
