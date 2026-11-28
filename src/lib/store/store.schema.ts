import { z } from "zod"

import type { TranslationKey } from "@/lib/i18n"

type T = (key: TranslationKey, vars?: Record<string, string | number>) => string

const MONEY = /^\d{0,15}(\.\d{1,4})?$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** Limits copied from store-service StoreForm (code ≤ 20 [A-Za-z0-9_-], name ≤ 255, address ≤ 500, phone ≤ 30). */
export function getStoreSchema(t: T) {
  const money = z.string().refine((v) => v.trim() === "" || MONEY.test(v.trim()), t("store.v.money"))
  const coord = (max: number) =>
    z.string().refine((v) => v.trim() === "" || (!Number.isNaN(Number(v)) && Math.abs(Number(v)) <= max), t("store.v.coord"))
  return z
    .object({
      code: z.string().trim().min(1, t("store.v.code")).max(20, t("store.v.code")).regex(/^[A-Za-z0-9_-]+$/, t("store.v.code")),
      name: z.string().trim().min(1, t("store.v.name")).max(255, t("store.v.name")),
      warehouseId: z.string().min(1, t("store.v.warehouse")),
      address: z.string().max(500),
      lat: coord(90),
      lon: coord(180),
      phone: z.string().max(30),
      timeZone: z.string().max(40),
      orderStart: z.string().regex(TIME, t("store.v.time")),
      orderEnd: z.string().regex(TIME, t("store.v.time")),
      deliveryFee: money,
      freeDeliveryThreshold: money,
      minOrderAmount: money,
      firstOrderMinAmount: money,
      bagFee: money,
      active: z.boolean(),
    })
    .refine((v) => !TIME.test(v.orderStart) || !TIME.test(v.orderEnd) || v.orderStart < v.orderEnd, {
      message: t("store.v.hours"),
      path: ["orderEnd"],
    })
}
export type TStoreSchema = z.infer<ReturnType<typeof getStoreSchema>>

/** The server checks the polygon (STO_009); here only that it is JSON and a name is given (≤ 100). */
export function getZoneSchema(t: T) {
  return z.object({
    name: z.string().trim().min(1, t("store.zone.v.name")).max(100, t("store.zone.v.name")),
    area: z.string().refine((v) => {
      try {
        const g = JSON.parse(v)
        return g?.type === "Polygon" && Array.isArray(g.coordinates)
      } catch {
        return false
      }
    }, t("store.zone.v.area")),
  })
}
export type TZoneSchema = z.infer<ReturnType<typeof getZoneSchema>>

/** Mirrors ShopSettingService.SLUG (3-40, a-z 0-9 '-', no '-' at either end); upper case is lowered by the server. */
export function getShopSettingSchema(t: T) {
  return z.object({
    slug: z
      .string()
      .trim()
      .refine((v) => /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(v.toLowerCase()), t("store.shop.v.slug")),
    enabled: z.boolean(),
  })
}
export type TShopSettingSchema = z.infer<ReturnType<typeof getShopSettingSchema>>
