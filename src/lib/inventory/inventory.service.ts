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

// Items and catalog (manual §9). Spec: inventory-service ItemController / ItemService (ItemCreateForm, ItemUpdateForm,
// ItemDto), ItemImageService (ImagesForm, up to 10 additional images of the company media library, INV_024),
// CatalogController (categories #RRGGBB, taxes 0..100 %, units), StockController POST /stock/add (AddStockForm).

export type EItemType = "PRODUCT" | "SERVICE" | "PART"

export interface ItemDto {
  id?: string
  type?: EItemType
  name?: string
  sku?: string
  taxId?: string | null
  taxName?: string | null
  taxRate?: number | null
  categoryId?: string
  categoryName?: string | null
  unitId?: string
  unitName?: string | null
  salePrice?: number
  purchasePrice?: number
  shortDescription?: string | null
  description?: string | null
  /** stock summed over warehouses; 0 for a service */
  quantity?: number
  /** media-service file id */
  mainImageId?: string | null
}

interface ItemBaseForm {
  type: EItemType
  name: string
  taxId?: number | null
  categoryId: number
  unitId: number
  salePrice: number
  purchasePrice: number
  shortDescription?: string | null
  description?: string | null
}
export interface ItemCreateForm extends ItemBaseForm {
  /** required unless generateSku (INV_011) */
  sku?: string | null
  generateSku?: boolean
  /** PRODUCT / PART only, both or neither (INV_016, INV_018) */
  openingWarehouseId?: number | null
  openingQuantity?: number | null
}
export interface ItemUpdateForm extends ItemBaseForm {
  sku: string
}

export interface ImagesDto {
  itemId?: string
  mainImageId?: string | null
  additionalImageIds?: string[]
}

export interface CategoryDto {
  id?: string
  name?: string
  /** #RRGGBB */
  color?: string | null
}
export interface TaxDto {
  id?: string
  name?: string
  rate?: number
}
export interface UnitDto {
  id?: string
  name?: string
}

export const ItemService = {
  list: (f: { keyword?: string; type?: string; categoryId?: string; page?: number; size?: number }) =>
    request<IPage<ItemDto>>(withQuery("/v1/inventory/items", { ...f })),
  get: (id: string) => request<ItemDto>(`/v1/inventory/items/${id}`),
  create: (body: ItemCreateForm) => request<ItemDto>("/v1/inventory/items", { method: "POST", body }),
  /** full replacement; stock changes only through /stock (INV_019 when a stocked item becomes a service) */
  update: (id: string, body: ItemUpdateForm) => request<ItemDto>(`/v1/inventory/items/${id}`, { method: "PUT", body }),
  /** soft delete */
  remove: (id: string) => request<void>(`/v1/inventory/items/${id}`, { method: "DELETE" }),
  images: (id: string) => request<ImagesDto>(`/v1/inventory/items/${id}/images`),
  /** stock of one item per warehouse (GET /inventory/stock?itemId=) */
  stockOfItem: (itemId: string) => request<StockDto[]>(withQuery("/v1/inventory/stock", { itemId })),
  /** full replacement of the main + additional images */
  setImages: (id: string, body: { mainImageId?: number | null; additionalImageIds: number[] }) =>
    request<ImagesDto>(`/v1/inventory/items/${id}/images`, { method: "PUT", body }),
  addStock: (body: { itemId: number; warehouseId: number; quantity: number }) =>
    request<StockDto>("/v1/inventory/stock/add", { method: "POST", body }),
}

const crud = <D, F>(path: string) => ({
  list: () => request<D[]>(path),
  save: (id: string | undefined, body: F) =>
    id ? request<D>(`${path}/${id}`, { method: "PUT", body }) : request<D>(path, { method: "POST", body }),
  /** INV_006 while an item uses it */
  remove: (id: string) => request<void>(`${path}/${id}`, { method: "DELETE" }),
})

export const CatalogService = {
  categories: crud<CategoryDto, { name: string; color?: string | null }>("/v1/inventory/categories"),
  taxes: crud<TaxDto, { name: string; rate: number }>("/v1/inventory/taxes"),
  units: crud<UnitDto, { name: string }>("/v1/inventory/units"),
}
