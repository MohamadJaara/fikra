"use client";

import { ContentDisclaimer } from "@/components/ContentDisclaimer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuthActions } from "@convex-dev/auth/react";
import { cn } from "@/lib/utils";
import {
  Lightbulb,
  List,
  PlusCircle,
  Activity,
  Compass,
  Menu,
  X,
  User,
  Bell,
  Settings,
  Shield,
  Users,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { NotificationBell } from "@/components/NotificationBell";

export type AppShellViewer = {
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  image?: string;
  isAdmin?: boolean;
  handle?: string;
} | null;

export function AppShell({
  children,
  viewer,
}: {
  children: ReactNode;
  viewer: AppShellViewer;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden md:flex w-56 flex-col border-r bg-muted/30">
        <div className="animate-slide-in-left">
          <SidebarContent viewer={viewer} />
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-56 bg-background border-r flex flex-col animate-slide-in-left">
            <SidebarContent
              viewer={viewer}
              onClose={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center gap-2 border-b px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
          <span className="font-semibold">Fikra</span>
          <div className="ml-auto">{viewer && <NotificationBell />}</div>
        </header>
        <div className="border-b px-4 py-3 md:px-6">
          <ContentDisclaimer />
        </div>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  viewer,
  onClose,
}: {
  viewer: AppShellViewer;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <Link
            href="/product"
            className="flex items-center gap-2 font-bold text-lg group"
            onClick={onClose}
          >
            <Lightbulb className="h-5 w-5 text-yellow-500 group-hover:animate-float transition-transform" />
            <span className="bg-gradient-to-r from-yellow-600 via-orange-500 to-amber-500 bg-clip-text text-transparent">
              Fikra
            </span>
          </Link>
          {viewer && <NotificationBell />}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Hackathon Idea Board
        </p>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        <NavLink
          href="/product"
          icon={<Sparkles className="h-4 w-4" />}
          onClick={onClose}
        >
          Themes
        </NavLink>
        <NavLink
          href="/product/discover"
          icon={<Compass className="h-4 w-4" />}
          onClick={onClose}
        >
          Discover
        </NavLink>
        <NavLink
          href="/product/ideas"
          icon={<List className="h-4 w-4" />}
          onClick={onClose}
        >
          All Ideas
        </NavLink>
        <NavLink
          href="/product/ideas/new"
          icon={<PlusCircle className="h-4 w-4" />}
          onClick={onClose}
        >
          Create Idea
        </NavLink>
        <NavLink
          href="/product/activity"
          icon={<Activity className="h-4 w-4" />}
          onClick={onClose}
        >
          My Activity
        </NavLink>
        <NavLink
          href="/product/people"
          icon={<Users className="h-4 w-4" />}
          onClick={onClose}
        >
          People
        </NavLink>
        <NavLink
          href="/product/notifications"
          icon={<Bell className="h-4 w-4" />}
          onClick={onClose}
        >
          Notifications
        </NavLink>
        <NavLink
          href="/product/settings"
          icon={<Settings className="h-4 w-4" />}
          onClick={onClose}
        >
          Settings
        </NavLink>
        {viewer?.isAdmin && (
          <NavLink
            href="/product/admin"
            icon={<Shield className="h-4 w-4" />}
            onClick={onClose}
          >
            Admin
          </NavLink>
        )}
      </nav>

      <div className="p-2 border-t space-y-2">
        <div className="px-2 py-1">
          <span className="text-xs text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
        <Link
          href={
            viewer?.handle
              ? `/product/profile/${viewer.handle}`
              : "/product/settings"
          }
          className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-muted/50 transition-colors"
          onClick={onClose}
        >
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
            {viewer?.image ? (
              <img src={viewer.image} alt="" className="h-8 w-8 rounded-full" />
            ) : (
              <User className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {viewer?.firstName
                ? `${viewer.firstName}${viewer.lastName ? ` ${viewer.lastName}` : ""}`
                : viewer?.name || "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {viewer?.email}
            </p>
          </div>
        </Link>
        <div className="px-2">
          <SignOutButton />
        </div>
      </div>
    </>
  );
}

function NavLink({
  href,
  icon,
  children,
  onClick,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive =
    href === "/product"
      ? pathname === "/product"
      : href === "/product/ideas"
        ? pathname === "/product/ideas"
        : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
        isActive
          ? "bg-muted text-primary"
          : "text-muted-foreground hover:text-primary hover:bg-muted/50",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

function SignOutButton() {
  const { signOut } = useAuthActions();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start text-muted-foreground"
      onClick={() => void signOut()}
    >
      Sign out
    </Button>
  );
}
