"use client"

import * as React from "react"
import { ImageIcon } from "lucide-react"

import { MediaService } from "@/lib/media/media.service"

// viewUrl is a signed link (MediaFileDto.linkExpiresAt); one lookup per file id per page load is enough here.
const cache = new Map<string, Promise<string | undefined>>()
const urlOf = (id: string) => {
  let p = cache.get(id)
  if (!p) {
    p = MediaService.file(id)
      .then((f) => (f.viewUrl?.startsWith("http") || f.viewUrl?.startsWith("/") ? f.viewUrl : undefined))
      .catch(() => undefined)
    cache.set(id, p)
  }
  return p
}

/** Square thumbnail of a media-service image, or a placeholder icon. */
export function MediaThumb({ fileId, alt, className = "size-10" }: { fileId?: string | null; alt: string; className?: string }) {
  const [src, setSrc] = React.useState<{ id: string; url?: string }>()
  React.useEffect(() => {
    if (!fileId) return
    let cancelled = false
    urlOf(fileId).then((url) => !cancelled && setSrc({ id: fileId, url }))
    return () => {
      cancelled = true
    }
  }, [fileId])
  const url = fileId && src?.id === fileId ? src.url : undefined
  return (
    <div className={`bg-muted flex shrink-0 items-center justify-center overflow-hidden rounded-md ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed media-service link, not a static asset
        <img src={url} alt={alt} className="size-full object-cover" />
      ) : (
        <ImageIcon className="text-muted-foreground size-4" aria-hidden />
      )}
    </div>
  )
}
