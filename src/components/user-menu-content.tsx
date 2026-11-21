"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, User } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useAuthStore } from "@/lib/auth/auth.store"
import { useT, type TranslationKey } from "@/lib/i18n"

/* ---------- Types ---------- */
export type UserInfo = {
  name: string
  email: string
  avatar: string
  role?: string
}

/** The logged-in user from GET /me and /me/profile, shaped for the menus. */
export function useCurrentUser(): UserInfo {
  const profile = useAuthStore((s) => s.profile)
  const me = useAuthStore((s) => s.me)
  return {
    name: profile?.fullName || profile?.username || me?.username || "-",
    email: profile?.email || "",
    avatar: profile?.avatarUrl || "",
    role: me?.superAdmin ? "Super Admin" : me?.roles?.[0],
  }
}

const MAIN_ITEMS: { title: TranslationKey; icon: React.ElementType; url: string }[] = [
  { title: "menu.profile", icon: User, url: "/profile" },
]

/* ---------- Styles ---------- */
const itemClass =
  "h-8 cursor-pointer gap-3 rounded-lg px-2.5 text-sm " +
  "focus:bg-foreground/10 focus:text-foreground " +
  "[&>svg]:size-4.5! [&>svg]:text-muted-foreground! " +
  "focus:[&>svg]:text-foreground!"

const logoutClass =
  "h-8 cursor-pointer gap-3 rounded-lg px-2.5 text-sm text-destructive " +
  "focus:bg-destructive/10 focus:text-destructive " +
  "[&>svg]:size-4.5! [&>svg]:text-destructive!"

/* ---------- Helpers ---------- */
export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

/* ---------- Shared dropdown content (header avatar + sidebar footer) ---------- */
type UserMenuContentProps = Omit<React.ComponentProps<typeof DropdownMenuContent>, "children"> & {
  user: UserInfo
}

export function UserMenuContent({ user, className, ...props }: UserMenuContentProps) {
  const t = useT()
  const router = useRouter()
  const logout = useAuthStore((s) => s.logout)

  async function handleLogout() {
    await logout()
    router.replace("/login")
  }

  return (
    <DropdownMenuContent
      sideOffset={10}
      collisionPadding={12}
      className={
        "max-h-(--radix-dropdown-menu-content-available-height) w-64 overflow-y-auto rounded-xl border border-border bg-popover/70 p-0 shadow-xl backdrop-blur-xl backdrop-saturate-150 " +
        (className ?? "")
      }
      {...props}
    >
      <DropdownMenuLabel className="rounded-t-xl border-b border-border bg-foreground/5 p-0 font-normal">
        <div className="flex items-center gap-3 px-3 py-3">
          <Avatar className="size-10 shrink-0 rounded-xl ring-2 ring-border">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="rounded-xl">{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              {user.role && (
                <Badge variant="secondary" className="h-4.5 px-1.5 text-[10px]">
                  {user.role}
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </DropdownMenuLabel>

      <div className="p-1.5">
        <DropdownMenuGroup>
          {MAIN_ITEMS.map(({ title, icon: Icon, url }) => (
            <DropdownMenuItem key={title} asChild className={itemClass}>
              <Link href={url}>
                <Icon />
                {t(title)}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1 bg-border" />

        <DropdownMenuItem className={logoutClass} onClick={handleLogout}>
          <LogOut />
          {t("menu.logout")}
        </DropdownMenuItem>
      </div>
    </DropdownMenuContent>
  )
}
