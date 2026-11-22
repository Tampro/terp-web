"use client"

import * as React from "react"

import { DocumentList } from "../_components/document-list"

/** §6.4 Quotations (commerce-service /v1/sales/quotations). */
export default function Page() {
  return (
    <React.Suspense>
      <DocumentList kind="QUOTATION" />
    </React.Suspense>
  )
}
