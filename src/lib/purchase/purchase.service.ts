"use client"

import { request, withQuery, type IPage } from "@/lib/api"
import type { EDocumentStatus, EReturnStatus, LineDto, ReturnableLine, ReturnForm } from "@/lib/sales/sales.service"

// Purchase (manual §8.1, §8.2). Spec: commerce-service PurchaseInvoiceController / PurchaseInvoiceService
// (InvoiceForm, InvoiceRow, InvoiceDetail) and PurchaseReturnController / PurchaseReturnService (ReturnForm, ReturnRow,
// ReturnDetail, ReturnableLine). Swagger merges same-named schemas with the sales ones (ReturnRow shows customerId):
// the purchase rows carry vendorId / vendorName (backend code). Vendors from accounting-service. Every field optional.

export type EPurchaseStatus = Extract<EDocumentStatus, "DRAFT" | "POSTED" | "PARTIAL" | "PAID">

export interface PurchaseInvoiceRow {
  id?: string
  /** PI-YYYY-MM-NNN */
  number?: string
  vendorId?: string
  vendorName?: string | null
  warehouseId?: string | null
  invoiceDate?: string
  dueDate?: string
  subtotal?: number
  discount?: number
  tax?: number
  total?: number
  balance?: number
  status?: EPurchaseStatus
  /** posted or partly paid past its due date */
  overdue?: boolean
}

export interface PurchaseInvoiceDetail {
  invoice?: PurchaseInvoiceRow
  paymentTerms?: string | null
  notes?: string | null
  lines?: LineDto[]
}

export interface PurchaseInvoiceForm {
  vendorId: number
  /** receiving warehouse; required to post stock items (PUR_005) */
  warehouseId?: number | null
  invoiceDate: string
  dueDate: string
  paymentTerms?: string | null
  notes?: string | null
  /** 1..200; quantity omit = 1, unitPrice omit = the item's purchase price */
  lines: { itemId: number; quantity?: number; unitPrice?: number; discountPct?: number }[]
}

export interface PurchaseFilter {
  vendorId?: string
  warehouseId?: string
  status?: string
  overdue?: boolean
  from?: string
  to?: string
  keyword?: string
  page?: number
  size?: number
}

export interface PurchaseReturnRow {
  id?: string
  /** PR-YYYY-MM-NNN */
  number?: string
  invoiceId?: string
  vendorId?: string
  vendorName?: string | null
  /** sending warehouse */
  warehouseId?: string | null
  returnDate?: string
  total?: number
  items?: number
  status?: EReturnStatus
}

export interface PurchaseReturnDetail {
  ret?: PurchaseReturnRow
  reason?: string | null
  notes?: string | null
  subtotal?: number
  discount?: number
  tax?: number
  lines?: LineDto[]
}

export interface VendorOption {
  id?: string
  vendorCode?: string
  companyName?: string
}

export type PurchaseStatusCounts = Partial<Record<EPurchaseStatus, number>>

export const PurchaseInvoiceService = {
  list: (f: PurchaseFilter) => request<IPage<PurchaseInvoiceRow>>(withQuery("/v1/purchase/invoices", { ...f })),
  counts: (f: Omit<PurchaseFilter, "status" | "overdue" | "page" | "size">) =>
    request<PurchaseStatusCounts>(withQuery("/v1/purchase/invoices/status-counts", { ...f })),
  get: (id: string) => request<PurchaseInvoiceDetail>(`/v1/purchase/invoices/${id}`),
  create: (body: PurchaseInvoiceForm) => request<PurchaseInvoiceDetail>("/v1/purchase/invoices", { method: "POST", body }),
  /** drafts only (PUR_002); full replacement */
  update: (id: string, body: PurchaseInvoiceForm) =>
    request<PurchaseInvoiceDetail>(`/v1/purchase/invoices/${id}`, { method: "PUT", body }),
  remove: (id: string) => request<void>(`/v1/purchase/invoices/${id}`, { method: "DELETE" }),
  /** DRAFT → POSTED: stock enters the receiving warehouse */
  post: (id: string) => request<PurchaseInvoiceDetail>(`/v1/purchase/invoices/${id}/post`, { method: "POST" }),
}

export const PurchaseReturnService = {
  list: (f: PurchaseFilter & { invoiceId?: string }) =>
    request<IPage<PurchaseReturnRow>>(withQuery("/v1/purchase/returns", { ...f })),
  get: (id: string) => request<PurchaseReturnDetail>(`/v1/purchase/returns/${id}`),
  /** PUR_012 "No items available for return" when nothing is left */
  returnable: (invoiceId: string) => request<ReturnableLine[]>(withQuery("/v1/purchase/returns/returnable", { invoiceId })),
  create: (body: ReturnForm) => request<PurchaseReturnDetail>("/v1/purchase/returns", { method: "POST", body }),
  update: (id: string, body: ReturnForm) => request<PurchaseReturnDetail>(`/v1/purchase/returns/${id}`, { method: "PUT", body }),
  remove: (id: string) => request<void>(`/v1/purchase/returns/${id}`, { method: "DELETE" }),
  approve: (id: string) => request<PurchaseReturnDetail>(`/v1/purchase/returns/${id}/approve`, { method: "POST" }),
  /** goods sent back: stock leaves the sending warehouse */
  complete: (id: string) => request<PurchaseReturnDetail>(`/v1/purchase/returns/${id}/complete`, { method: "POST" }),
}

export const VendorLookupService = {
  /** TODO(assumption): the first 50 vendors are enough until a searchable picker is needed */
  vendors: () => request<IPage<VendorOption>>(withQuery("/v1/accounting/vendors", { size: 50 })),
}
