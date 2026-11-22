"use client"

import * as React from "react"
import { Paperclip, Search, Send, Star } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthStore } from "@/lib/auth/auth.store"
import { MessengerService, type Conversation, type Message } from "@/lib/support/support.service"
import { formatDate } from "@/lib/format"
import { useLanguageStore, useT } from "@/lib/i18n"

import { attempt, errorMessage, FileInput } from "../hrm/_components/crud-kit"

const POLL_MS = 5000
type User = { id?: string; fullName?: string | null; username?: string; email?: string; status?: string }

export default function MessengerPage() {
  return (
    <React.Suspense>
      <Messenger />
    </React.Suspense>
  )
}

/**
 * §18 messenger: one-to-one chat inside the company (MESSENGER_USE), favorites first, unread badges. There is no push
 * channel, so the open conversation and the list are polled every 5 s. TODO(assumption): polling is enough until the
 * backend offers a WebSocket / SSE channel.
 */
function Messenger() {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const myId = useAuthStore((s) => s.me?.userId)
  const [users, setUsers] = React.useState<User[]>([])
  const [convs, setConvs] = React.useState<Conversation[]>()
  const [tick, setTick] = React.useState(0)
  const [active, setActive] = React.useState<string>()
  const [messages, setMessages] = React.useState<{ userId: string; list: Message[] }>()
  const [text, setText] = React.useState("")
  const [file, setFile] = React.useState<{ id: string; name: string }>()
  const [filter, setFilter] = React.useState("")
  const bottom = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    let cancelled = false
    MessengerService.users()
      .then((p) => !cancelled && setUsers((p.content ?? []).filter((u) => u.status !== "INACTIVE")))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])
  React.useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), POLL_MS)
    return () => clearInterval(id)
  }, [])
  React.useEffect(() => {
    let cancelled = false
    MessengerService.conversations()
      .then((p) => !cancelled && setConvs(p.content ?? []))
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [tick])
  React.useEffect(() => {
    if (!active) return
    let cancelled = false
    MessengerService.messages(active)
      .then(async (p) => {
        if (cancelled) return
        // newest first from the backend → oldest first on screen
        const list = [...(p.content ?? [])].sort((a, b) => String(a.createdDate).localeCompare(String(b.createdDate)))
        setMessages((prev) => {
          if (prev?.userId === active && prev.list.length === list.length && prev.list.at(-1)?.id === list.at(-1)?.id) return prev
          return { userId: active, list }
        })
        if (list.some((m) => !m.mine && !m.seen)) await MessengerService.read(active).catch(() => undefined)
      })
      .catch((e: Error) => !cancelled && toast.error(e.message))
    return () => {
      cancelled = true
    }
  }, [active, tick])
  React.useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: "end" })
  }, [messages])

  const name = (id?: string) => {
    const u = users.find((x) => x.id === id)
    return u ? u.fullName || u.username || u.email || id : `#${id}`
  }
  const byUser = new Map((convs ?? []).map((c) => [c.userId, c]))
  const people = users
    .filter((u) => u.id !== myId)
    .map((u) => ({ id: u.id ?? "", conv: byUser.get(u.id) }))
    .concat((convs ?? []).filter((c) => !users.some((u) => u.id === c.userId)).map((c) => ({ id: c.userId ?? "", conv: c })))
    .filter((p) => !filter || String(name(p.id)).toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => Number(!!b.conv?.favorite) - Number(!!a.conv?.favorite) || String(b.conv?.lastMessage?.createdDate ?? "").localeCompare(String(a.conv?.lastMessage?.createdDate ?? "")) || String(name(a.id)).localeCompare(String(name(b.id))))
  const activeConv = active ? byUser.get(active) : undefined
  const list = messages && messages.userId === active ? messages.list : undefined

  async function send() {
    if (!active || (!text.trim() && !file)) return
    const body = { body: text.trim() || undefined, attachmentFileId: file ? Number(file.id) : undefined }
    try {
      await MessengerService.send(active, body)
      setText("")
      setFile(undefined)
      setTick((x) => x + 1)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
  const time = (s?: string) => (s ? `${formatDate(s.slice(0, 10), language)} ${new Date(s).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })}` : "")

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("menu.sp.messenger")}</h1>
        <p className="text-muted-foreground text-sm">{t("sp.messenger.subtitle")}</p>
      </div>
      <Card className="grid h-[70vh] grid-cols-1 gap-0 overflow-hidden p-0 md:grid-cols-[18rem_1fr]">
        <aside className={`flex min-h-0 flex-col border-r ${active ? "hidden md:flex" : "flex"}`}>
          <div className="relative border-b p-2">
            <Search className="text-muted-foreground absolute top-1/2 left-4 size-4 -translate-y-1/2" />
            <Input className="pl-8" aria-label={t("sp.findPeople")} placeholder={t("sp.findPeople")} value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto" aria-label={t("sp.conversations")}>
            {!convs && (
              <li className="p-3">
                <Skeleton className="h-10 w-full" />
              </li>
            )}
            {convs && people.length === 0 && <li className="text-muted-foreground p-4 text-sm">{t("sp.noPeople")}</li>}
            {people.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setActive(p.id)} className={`hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left ${active === p.id ? "bg-accent" : ""}`}>
                  <span className="bg-primary/15 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">{String(name(p.id)).slice(0, 2).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-sm font-medium">
                      {name(p.id)} {p.conv?.favorite && <Star className="size-3 fill-amber-400 text-amber-400" aria-label={t("sp.favorite")} />}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">{p.conv?.lastMessage?.body ?? p.conv?.lastMessage?.attachmentName ?? ""}</span>
                  </span>
                  {!!p.conv?.unreadCount && <Badge aria-label={t("sp.unread", { n: p.conv.unreadCount })}>{p.conv.unreadCount}</Badge>}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section className={`min-h-0 flex-col ${active ? "flex" : "hidden md:flex"}`}>
          {!active ? (
            <p className="text-muted-foreground m-auto text-sm">{t("sp.pickConversation")}</p>
          ) : (
            <>
              <header className="flex items-center justify-between gap-2 border-b p-3">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setActive(undefined)}>
                    ←
                  </Button>
                  <span className="font-medium" data-testid="chat-with">
                    {name(active)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-pressed={!!activeConv?.favorite}
                  aria-label={activeConv?.favorite ? t("sp.unfavorite") : t("sp.favorite")}
                  onClick={async () => (await attempt(() => MessengerService.favorite(active, !activeConv?.favorite))) && setTick((x) => x + 1)}
                >
                  <Star className={`size-4 ${activeConv?.favorite ? "fill-amber-400 text-amber-400" : ""}`} />
                </Button>
              </header>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" role="log" aria-label={t("sp.messages")}>
                {!list ? (
                  <Skeleton className="h-16 w-full" />
                ) : list.length === 0 ? (
                  <p className="text-muted-foreground text-center text-sm">{t("sp.sayHello")}</p>
                ) : (
                  list.map((m) => (
                    <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${m.mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                        {m.attachmentName && (
                          <p className="mt-1 inline-flex items-center gap-1 text-xs opacity-80">
                            <Paperclip className="size-3" /> {m.attachmentName}
                          </p>
                        )}
                        <p className="mt-1 text-[10px] opacity-70">
                          {time(m.createdDate)}
                          {m.mine && m.seen && ` · ${t("sp.seen")}`}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottom} />
              </div>
              <form
                className="flex flex-wrap items-end gap-2 border-t p-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  void send()
                }}
              >
                <Input className="min-w-40 flex-1" aria-label={t("sp.typeMessage")} placeholder={t("sp.typeMessage")} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} />
                {file ? (
                  <Badge variant="secondary" className="cursor-pointer" onClick={() => setFile(undefined)}>
                    <Paperclip className="size-3" /> {file.name} ✕
                  </Badge>
                ) : (
                  <FileInput id="chat-file" label={t("sp.attach")} onUploaded={(id, n) => setFile({ id, name: n })} />
                )}
                <Button type="submit" disabled={!text.trim() && !file} aria-label={t("sp.send")}>
                  <Send className="size-4" />
                </Button>
              </form>
            </>
          )}
        </section>
      </Card>
    </div>
  )
}
