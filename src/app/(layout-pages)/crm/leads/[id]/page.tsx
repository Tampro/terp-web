"use client"

import * as React from "react"
import { useParams } from "next/navigation"

import { RecordDetail } from "../../_components/record-detail"

/** §7.2 lead detail. */
export default function Page() {
  const { id } = useParams<{ id: string }>()
  return (
    <React.Suspense>
      <RecordDetail subject="leads" id={id} />
    </React.Suspense>
  )
}
