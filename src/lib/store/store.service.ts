"use client"

import { request, withQuery, type IPage } from "@/lib/api"

// Stores of the chain, their delivery zones and day-offs, and the company's public shop (store-service).
// Spec: StoreController (StoreForm, StoreDto, OrderableDto), StoreZoneController (ZoneForm, ZoneDto),
// StoreDayOffController (DayOffForm, DayOffDto), ShopSettingController (ShopSettingForm, ShopSettingDto).
// Errors: STO_001 store missing, STO_002 code used, STO_003 warehouse of another store, STO_004 warehouse invalid,
// STO_005 hours / time zone, STO_006 inventory down, STO_008 zone missing, STO_009 zone area invalid,
// STO_011 day-off exists, STO_012 day-off in the past, STO_013 day-off missing, STO_014 slug used, STO_015 slug reserved.

export interface StoreDto {
  id?: string
  code?: string
  name?: string
  warehouseId?: string
  address?: string | null
  lat?: number | null
  lon?: number | null
  phone?: string | null
  timeZone?: string
  orderStart?: string
  orderEnd?: string
  deliveryFee?: number
  freeDeliveryThreshold?: number
  minOrderAmount?: number
  firstOrderMinAmount?: number
  bagFee?: number
  active?: boolean
}

export interface StoreForm {
  code: string
  name: string
  warehouseId: number
  address?: string | null
  lat?: number | null
  lon?: number | null
  phone?: string | null
  timeZone?: string | null
  orderStart: string
  orderEnd: string
  deliveryFee?: number | null
  freeDeliveryThreshold?: number | null
  minOrderAmount?: number | null
  firstOrderMinAmount?: number | null
  bagFee?: number | null
  active?: boolean
}

export interface OrderableDto {
  orderableNow?: boolean
  opensAt?: string | null
}

export interface GeoJsonPolygon {
  type?: string
  coordinates?: number[][][]
}

export interface ZoneDto {
  id?: string
  storeId?: string
  name?: string
  area?: GeoJsonPolygon
  active?: boolean
}

export interface ZoneForm {
  name: string
  area: GeoJsonPolygon
  active?: boolean
}

export interface DayOffDto {
  id?: string
  storeId?: string
  date?: string
  reason?: string | null
}

export interface ShopSettingDto {
  companyId?: string
  slug?: string | null
  enabled?: boolean
}

export const StoreService = {
  list: (f: { keyword?: string; active?: boolean; page?: number; size?: number }) =>
    request<IPage<StoreDto>>(withQuery("/v1/store/stores", { ...f })),
  create: (body: StoreForm) => request<StoreDto>("/v1/store/stores", { method: "POST", body }),
  /** Full replacement: omitted fees become 0. */
  update: (id: string, body: StoreForm) => request<StoreDto>(`/v1/store/stores/${id}`, { method: "PUT", body }),
  remove: (id: string) => request<void>(`/v1/store/stores/${id}`, { method: "DELETE" }),
  orderable: (id: string) => request<OrderableDto>(`/v1/store/stores/${id}/orderable`),
}

export const ZoneService = {
  list: (storeId: string) => request<ZoneDto[]>(`/v1/store/stores/${storeId}/zones`),
  create: (storeId: string, body: ZoneForm) => request<ZoneDto>(`/v1/store/stores/${storeId}/zones`, { method: "POST", body }),
  remove: (storeId: string, id: string) => request<void>(`/v1/store/stores/${storeId}/zones/${id}`, { method: "DELETE" }),
}

export const DayOffService = {
  list: (storeId: string) => request<DayOffDto[]>(`/v1/store/stores/${storeId}/day-offs`),
  create: (storeId: string, body: { date: string; reason?: string | null }) =>
    request<DayOffDto>(`/v1/store/stores/${storeId}/day-offs`, { method: "POST", body }),
  remove: (storeId: string, id: string) => request<void>(`/v1/store/stores/${storeId}/day-offs/${id}`, { method: "DELETE" }),
}

export const ShopSettingService = {
  get: () => request<ShopSettingDto>("/v1/store/shop-setting"),
  /** Full replacement of slug and enabled. */
  save: (body: { slug: string; enabled: boolean }) =>
    request<ShopSettingDto>("/v1/store/shop-setting", { method: "PUT", body }),
}
