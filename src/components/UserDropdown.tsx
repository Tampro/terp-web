"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { UserMenuContent, getInitials, useCurrentUser } from "@/components/user-menu-content"

export function UserDropdown() {
  const user = useCurrentUser()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label={user.name} className="relative ml-2 h-10 w-10 overflow-visible rounded-full p-0">
          <Avatar className="h-10 w-10 rounded-full">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <UserMenuContent user={user} side="bottom" align="end" />
    </DropdownMenu>
  )
}
