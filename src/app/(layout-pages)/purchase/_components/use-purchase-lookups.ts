"use client"

import * as React from "react"

import { VendorLookupService, type VendorOption } from "@/lib/purchase/purchase.service"
import { SalesLookupService, type ItemOption, type WarehouseOption } from "@/lib/sales/sales.service"

export interface PurchaseLookups {
  vendors: VendorOption[]
  items: ItemOption[]
  warehouses: WarehouseOption[]
  loading: boolean
  /** first failure (e.g. COMMON_004 without VENDOR_VIEW / INVENTORY_VIEW) */
  error?: string
}

/** Vendors (accounting-service), items and active warehouses (inventory-service) for the filters and forms. */
export function usePurchaseLookups(): PurchaseLookups {
  const [state, setState] = React.useState<PurchaseLookups>({ vendors: [], items: [], warehouses: [], loading: true })
  React.useEffect(() => {
    let cancelled = false
    const errors: string[] = []
    const safe = <T,>(p: Promise<{ content?: T[] }>) =>
      p.then((r) => r.content ?? []).catch((e: Error) => (errors.push(e.message), [] as T[]))
    Promise.all([
      safe<VendorOption>(VendorLookupService.vendors()),
      safe<ItemOption>(SalesLookupService.items()),
      safe<WarehouseOption>(SalesLookupService.warehouses()),
    ]).then(([vendors, items, warehouses]) => {
      if (!cancelled) setState({ vendors, items, warehouses, loading: false, error: errors[0] })
    })
    return () => {
      cancelled = true
    }
  }, [])
  return state
}
