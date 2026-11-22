"use client"

import * as React from "react"

import { NotePage } from "../_components/note-page"

/** §12 debit-notes. */
export default function Page() {
  return (
    <React.Suspense>
      <NotePage kind="debit-notes" />
    </React.Suspense>
  )
}
