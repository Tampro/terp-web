import type { StoreItemBulkLine, StoreItemStatus } from "@/lib/inventory/inventory.service"

/** BE limit of POST /inventory/store-items/bulk (INV_029). */
export const STORE_ITEM_BULK_MAX = 1000
export const STORE_ITEM_CSV_MAX_BYTES = 1024 * 1024
const HEADER = ["sku", "salePrice", "status", "purchaseLimitQty"] as const

export type StoreItemCsvError =
  | "header"
  | "empty"
  | "tooMany"
  | "sku"
  | "price"
  | "status"
  | "limit"

export type StoreItemCsvResult =
  | { lines: StoreItemBulkLine[] }
  | { error: StoreItemCsvError; row?: number }

/** One CSV record per line; "" inside quotes escapes a quote, commas inside quotes are kept. */
function splitRow(line: string): string[] {
  const out: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ",") {
      out.push(cell)
      cell = ""
    } else cell += ch
  }
  out.push(cell)
  return out.map((c) => c.trim())
}

/**
 * Parses `sku,salePrice,status,purchaseLimitQty` (status and limit optional) for one store. Checks what the browser can
 * (header, row count, empty SKU, numbers) and reports the 1-based data row; SKU existence is the backend's (INV_028).
 */
export function parseStoreItemCsv(text: string, warehouseId: number): StoreItemCsvResult {
  const rows = text
    .replace(/^﻿/, "") // BOM written by Excel
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
  if (rows.length === 0) return { error: "empty" }
  const header = splitRow(rows[0]).map((h) => h.toLowerCase())
  const col = (name: (typeof HEADER)[number]) => header.indexOf(name.toLowerCase())
  if (col("sku") < 0 || col("salePrice") < 0) return { error: "header" }
  const data = rows.slice(1)
  if (data.length === 0) return { error: "empty" }
  if (data.length > STORE_ITEM_BULK_MAX) return { error: "tooMany" }

  const lines: StoreItemBulkLine[] = []
  for (let i = 0; i < data.length; i++) {
    const cells = splitRow(data[i])
    const cell = (name: (typeof HEADER)[number]) => (col(name) < 0 ? "" : (cells[col(name)] ?? ""))
    const row = i + 1
    const sku = cell("sku")
    if (!sku) return { error: "sku", row }
    const price = cell("salePrice")
    if (price === "" || !Number.isFinite(Number(price)) || Number(price) < 0) return { error: "price", row }
    const status = cell("status").toUpperCase()
    if (status !== "" && status !== "ON_SALE" && status !== "SUSPENDED") return { error: "status", row }
    const limit = cell("purchaseLimitQty")
    if (limit !== "" && !(/^\d+$/.test(limit) && Number(limit) >= 1)) return { error: "limit", row }
    lines.push({
      warehouseId,
      sku,
      salePrice: Number(price),
      ...(status ? { status: status as StoreItemStatus } : {}),
      purchaseLimitQty: limit === "" ? null : Number(limit),
    })
  }
  return { lines }
}

export function storeItemCsvTemplate(): string {
  return `${HEADER.join(",")}\nSKU-001,5990,ON_SALE,10\nSKU-002,12900,,\n`
}
