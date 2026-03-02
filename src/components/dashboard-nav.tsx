"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useSyncExternalStore } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import {
  Store,
  BookOpen,
  MessageCircle,
  LogOut,
  Plus,
  Menu,
  X,
  Home,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface DashboardNavProps {
  user: {
    id: string
    email?: string
  }
  profile: {
    display_name: string | null
    avatar_url: string | null
  } | null
}

const navLinks = [
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/villages", label: "My Villages", icon: Home },
  { href: "/collections", label: "My Collections", icon: Store },
  { href: "/borrows", label: "My Borrows", icon: BookOpen },
]

function getInitials(name: string | null, email?: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }
  if (email) {
    return email[0].toUpperCase()
  }
  return "U"
}

export function DashboardNav({ user, profile }: DashboardNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  const displayName = profile?.display_name || user.email || "User"
  const initials = getInitials(profile?.display_name ?? null, user.email)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  function isActive(href: string): boolean {
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-card">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo / Brand */}
          <div className="flex items-center h-16 px-6">
            <Link href="/chat" className="flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold">VillageShare</span>
            </Link>
          </div>

          <Separator />

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon
              const active = isActive(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              )
            })}

            <Separator className="my-3" />

            <Link
              href="/collections/new"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create New Collection
            </Link>
          </nav>

          {/* User section at bottom */}
          <div className="border-t p-3">
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors">
                    <Avatar size="sm">
                      {profile?.avatar_url && (
                        <AvatarImage src={profile.avatar_url} alt={displayName} />
                      )}
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      {user.email && (
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </p>
                      )}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm">
                <Avatar size="sm">
                  {profile?.avatar_url && (
                    <AvatarImage src={profile.avatar_url} alt={displayName} />
                  )}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  {user.email && (
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between h-14 border-b bg-card px-4">
        <Link href="/" className="flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          <span className="font-semibold">VillageShare</span>
        </Link>

        <div className="flex items-center gap-2">
          {mounted ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <Avatar size="sm">
                    {profile?.avatar_url && (
                      <AvatarImage src={profile.avatar_url} alt={displayName} />
                    )}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="icon-sm">
              <Avatar size="sm">
                {profile?.avatar_url && (
                  <AvatarImage src={profile.avatar_url} alt={displayName} />
                )}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </header>

      {/* Mobile Navigation Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-14 z-30 bg-background/80 backdrop-blur-sm">
          <nav className="bg-card border-b p-4 space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon
              const active = isActive(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              )
            })}

            <Separator className="my-2" />

            <Link
              href="/collections/new"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create New Collection
            </Link>
          </nav>
        </div>
      )}
    </>
  )
}
