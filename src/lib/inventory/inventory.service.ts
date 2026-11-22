"use client"

import { request, withQuery, type IPage } from "@/lib/api"

// Warehouses and stock transfers (manual §8.3, §8.4). Spec: inventory-service WarehouseController (WarehouseForm,
// WarehouseDto), StockTransferController (TransferForm, TransferDto), StockController (GET /inventory/stock). Errors
// INV_008 (warehouse holds stock), INV_015 (inactive warehouse), INV_017 (not enough stock), INV_022 (same warehouse).

export interface WarehouseDto {
  id?: string
  name?: string
  address?: string
  city?: string
  zipCode?: string
  phone?: string | null
  email?: string | null
  active?: boolean
}

export interface WarehouseForm {
  name: string
  address: string
  city: string
  zipCode: string
  phone?: string | null
  email?: string | null
  active: boolean
}

export interface TransferDto {
  id?: string
  fromWarehouseId?: string
  toWarehouseId?: string
  itemId?: string
  quantity?: number
  transferDate?: string
  createdDate?: string
}

export interface TransferForm {
  fromWarehouseId: number
  toWarehouseId: number
  itemId: number
  quantity: number
  transferDate: string
}

export interface StockDto {
  itemId?: string
  warehouseId?: string
  warehouseName?: string
  quantity?: number
}

export const WarehouseService = {
  list: (f: { keyword?: string; city?: string; active?: boolean; page?: number; size?: number }) =>
    request<IPage<WarehouseDto>>(withQuery("/v1/inventory/warehouses", { ...f })),
  create: (body: WarehouseForm) => request<WarehouseDto>("/v1/inventory/warehouses", { method: "POST", body }),
  /** full replacement */
  update: (id: string, body: WarehouseForm) => request<WarehouseDto>(`/v1/inventory/warehouses/${id}`, { method: "PUT", body }),
  remove: (id: string) => request<void>(`/v1/inventory/warehouses/${id}`, { method: "DELETE" }),
}

export const TransferService = {
  list: (f: {
    fromWarehouseId?: string
    toWarehouseId?: string
    itemId?: string
    dateFrom?: string
    dateTo?: string
    page?: number
    size?: number
  }) => request<IPage<TransferDto>>(withQuery("/v1/inventory/transfers", { ...f })),
  create: (body: TransferForm) => request<TransferDto>("/v1/inventory/transfers", { method: "POST", body }),
  remove: (id: string) => request<void>(`/v1/inventory/transfers/${id}`, { method: "DELETE" }),
  /** stock rows of one warehouse (item + quantity) */
  stock: (warehouseId: string) => request<StockDto[]>(withQuery("/v1/inventory/stock", { warehouseId })),
}
