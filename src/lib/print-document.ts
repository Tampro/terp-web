"use client"

/**
 * Printable copy of a document, opened in a new window with the browser's print dialog ("Save as PDF" there gives the
 * PDF). Used where the backend has no PDF endpoint for staff (§6 sales documents: only the client portal has
 * /portal/client/{kind}/{id}/pdf). Every text is escaped; the window title (= the file name a PDF printer suggests)
 * is the document title.
 */
export interface PrintableDocument {
  /** window title and heading, e.g. "Hoá đơn INV-2026-11-001" */
  title: string
  /** company or brand name above the heading */
  issuer?: string
  /** status label shown next to the heading */
  status?: string
  fields: { label: string; value: string }[]
  columns: { label: string; align?: "right" }[]
  rows: string[][]
  totals: { label: string; value: string; strong?: boolean }[]
  notesLabel: string
  notes?: string | null
  footer?: string
}

const esc = (s: string | null | undefined) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c)

export function documentHtml(d: PrintableDocument, lang: string) {
  const th = d.columns.map((c) => `<th${c.align === "right" ? ' class="r"' : ""}>${esc(c.label)}</th>`).join("")
  const tr = d.rows
    .map((r) => `<tr>${r.map((v, i) => `<td${d.columns[i]?.align === "right" ? ' class="r"' : ""}>${esc(v)}</td>`).join("")}</tr>`)
    .join("")
  return `<!doctype html><html lang="${esc(lang)}"><head><meta charset="utf-8"><title>${esc(d.title)}</title><style>
*{box-sizing:border-box}body{font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#111;margin:32px}
.issuer{color:#555;font-size:12px;margin-bottom:4px}h1{font-size:20px;margin:0 0 4px}.status{display:inline-block;border:1px solid #999;border-radius:4px;padding:0 6px;font-size:11px;margin-left:8px;vertical-align:middle}
dl.f{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 16px;margin:16px 0}dl.f dt{color:#666;font-size:11px}dl.f dd{margin:0;font-weight:600}
table{width:100%;border-collapse:collapse;margin:8px 0 16px}th,td{border-bottom:1px solid #ddd;padding:6px 4px;text-align:left;vertical-align:top;white-space:pre-line}th{font-size:11px;color:#555}.r{text-align:right}
.bottom{display:flex;gap:32px;justify-content:space-between}.notes{flex:1;white-space:pre-wrap}.notes p{color:#666;font-size:11px;margin:0}
dl.t{min-width:260px;margin:0}dl.t div{display:flex;justify-content:space-between;gap:16px;padding:2px 0}dl.t .s{border-top:1px solid #333;font-weight:700;margin-top:4px;padding-top:4px}
footer{margin-top:32px;color:#888;font-size:11px}@page{margin:14mm}@media print{body{margin:0}}
</style></head><body>
${d.issuer ? `<div class="issuer">${esc(d.issuer)}</div>` : ""}<h1>${esc(d.title)}${d.status ? `<span class="status">${esc(d.status)}</span>` : ""}</h1>
<dl class="f">${d.fields.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join("")}</dl>
<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>
<div class="bottom"><div class="notes"><p>${esc(d.notesLabel)}</p>${esc(d.notes || "-")}</div>
<dl class="t">${d.totals.map((x) => `<div${x.strong ? ' class="s"' : ""}><dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd></div>`).join("")}</dl></div>
${d.footer ? `<footer>${esc(d.footer)}</footer>` : ""}
</body></html>`
}

/**
 * Opens the printable copy and the print dialog. Must run inside the click handler (popup blockers). Returns false
 * when the browser blocked the window.
 */
export function printDocument(d: PrintableDocument, lang: string): boolean {
  const w = window.open("", "_blank", "width=900,height=1000")
  if (!w) return false
  w.document.open()
  w.document.write(documentHtml(d, lang))
  w.document.close()
  w.focus()
  // wait for layout (and fonts) before printing; the window stays open so it can be printed again
  w.addEventListener("load", () => w.print(), { once: true })
  if (w.document.readyState === "complete") setTimeout(() => w.print(), 50)
  return true
}
