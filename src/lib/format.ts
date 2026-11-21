/** Display helpers. Every function accepts missing values and returns "-" for them. */

const LOCALES: Record<string, string> = { vi: "vi-VN", en: "en-US", ko: "ko-KR" }
const loc = (language: string) => LOCALES[language] ?? language

export function formatDate(value: string | null | undefined, language: string, withTime = false) {
  if (!value) return "-"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "-"
  return d.toLocaleString(loc(language), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  })
}

export function formatNumber(value: number | null | undefined, language: string, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-"
  return value.toLocaleString(loc(language), { maximumFractionDigits: digits })
}

export function formatBytes(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "-"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
