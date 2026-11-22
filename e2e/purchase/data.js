// @ts-check
/** Mock data for §8 (commerce-service purchase DTOs, inventory-service). Names start with "E2E", no real PII. */

export const PURCHASE_ALL = ["PURCHASE_VIEW", "PURCHASE_MANAGE", "PURCHASE_POST", "INVENTORY_VIEW", "INVENTORY_MANAGE"]

export const VENDORS = [
  { id: "701", vendorCode: "V-01", companyName: "E2E Global Supplies" },
  { id: "702", vendorCode: "V-02", companyName: "E2E 한빛 부품" },
]
export const ITEMS = [
  { id: "601", name: "E2E Keyboard", sku: "KB-01", type: "PRODUCT", purchasePrice: 80000, taxName: "VAT", taxRate: 10 },
  { id: "602", name: "E2E Mouse", sku: "MS-01", type: "PRODUCT", purchasePrice: 20000, taxRate: null },
]
export const WAREHOUSES = [
  { id: "801", name: "E2E Kho Hà Nội", address: "1 E2E Street", city: "Hà Nội", zipCode: "100000", active: true },
  { id: "802", name: "E2E Kho HCM", address: "2 E2E Street", city: "Hồ Chí Minh", zipCode: "700000", active: true },
]

export const INVOICES = [
  {
    id: "901",
    number: "PI-2026-11-001",
    vendorId: "701",
    vendorName: "E2E Global Supplies",
    warehouseId: "801",
    invoiceDate: "2026-11-01",
    dueDate: "2026-11-15",
    total: 880000,
    balance: 880000,
    status: "POSTED",
    overdue: true,
  },
  {
    id: "902",
    number: "PI-2026-11-002",
    vendorId: "702",
    vendorName: "E2E 한빛 부품",
    warehouseId: "801",
    invoiceDate: "2026-11-20",
    dueDate: "2026-12-20",
    total: 200000,
    balance: 200000,
    status: "DRAFT",
    overdue: false,
  },
]
export const COUNTS = { DRAFT: 1, POSTED: 1, PARTIAL: 0, PAID: 0 }
export const INVOICE_DETAIL = {
  invoice: INVOICES[0],
  paymentTerms: "Net 30",
  notes: null,
  lines: [{ id: "1", itemId: "601", itemName: "E2E Keyboard", sku: "KB-01", quantity: 10, unitPrice: 80000, lineTotal: 880000 }],
}

export const RETURNS = [
  {
    id: "951",
    number: "PR-2026-11-001",
    invoiceId: "901",
    vendorId: "701",
    vendorName: "E2E Global Supplies",
    warehouseId: "801",
    returnDate: "2026-11-21",
    total: 176000,
    items: 1,
    status: "DRAFT",
  },
  { ...{ id: "952", number: "PR-2026-11-002", invoiceId: "901", vendorName: "E2E Global Supplies", status: "APPROVED", total: 88000, items: 1 } },
]
export const RETURNABLE = [
  { invoiceLineId: "11", itemId: "601", itemName: "E2E Keyboard", sku: "KB-01", invoiced: 10, returnable: 8, unitPrice: 80000, discountPct: 0, taxRate: 10 },
]

export const TRANSFERS = [
  { id: "1", fromWarehouseId: "801", toWarehouseId: "802", itemId: "601", quantity: 3, transferDate: "2026-11-21" },
]
export const STOCK_801 = [
  { itemId: "601", warehouseId: "801", quantity: 64 },
  { itemId: "602", warehouseId: "801", quantity: 0 },
]
