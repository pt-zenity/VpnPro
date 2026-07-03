"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Server,
  Users,
  Briefcase,
  FileText,
  UserCog,
  LogOut,
  Menu,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Logo } from "@/components/ui/logo";

type Role = "SUPERADMIN" | "ADMIN" | "MANAGER";

const baseNav = [
  { name: "Dashboard",  href: "/dashboard",           icon: LayoutDashboard },
  { name: "Nodes",      href: "/dashboard/nodes",      icon: Server },
  { name: "Clients",    href: "/dashboard/clients",    icon: Users },
  { name: "Jobs",       href: "/dashboard/jobs",       icon: Briefcase },
  { name: "Audit Logs", href: "/dashboard/audit",      icon: FileText },
];

const adminNav = [
  { name: "Managers", href: "/dashboard/managers", icon: UserCog },
];

function navFor(role?: Role) {
  return role && role !== "MANAGER" ? [...baseNav, ...adminNav] : baseNav;
}

function SidebarInner({
  userEmail,
  role,
  onNavigate,
}: {
  userEmail?: string;
  role?: Role;
  onNavigate?: () => void;
}) {
  const pathname   = usePathname();
  const navigation = navFor(role);
  const roleLabel  = role === "MANAGER" ? "Manager" : "Administrator";
  const initials   = userEmail ? userEmail[0].toUpperCase() : "A";

  return (
    <div className="flex h-full w-full flex-col">
      {/* ── Logo ── */}
      <div className="flex h-16 items-center px-5 border-b border-white/[0.05]">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 group"
          onClick={onNavigate}
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-[hsl(192_100%_58%/0.20)] blur-md group-hover:bg-[hsl(192_100%_58%/0.30)] transition-all duration-300" />
            <Logo size={34} className="relative" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            <span className="gradient-text">OVPN</span>
            <span className="text-foreground/90"> Admin</span>
          </span>
        </Link>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 space-y-0.5 px-3 py-4" aria-label="Primary">
        {navigation.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                "transition-all duration-200",
                isActive
                  ? [
                      "bg-[hsl(192_100%_58%/0.10)]",
                      "border border-[hsl(192_100%_58%/0.20)]",
                      "text-[hsl(192_100%_68%)]",
                      "shadow-[0_0_16px_hsl(192_100%_58%/0.08)]",
                    ].join(" ")
                  : [
                      "text-muted-foreground border border-transparent",
                      "hover:bg-white/[0.04] hover:text-foreground",
                      "hover:border-white/[0.06]",
                    ].join(" ")
              )}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* ── User section ── */}
      <div className="border-t border-white/[0.05] p-3 space-y-1">
        {/* User info pill */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
          {/* Avatar with glow */}
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-full bg-[hsl(192_100%_58%/0.25)] blur-sm" />
            <div className="relative h-8 w-8 rounded-full bg-gradient-to-br from-[hsl(192_100%_58%)] to-[hsl(265_80%_68%)] flex items-center justify-center text-xs font-bold text-white shadow-[0_0_12px_hsl(192_100%_58%/0.40)]">
              {initials}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-[hsl(192_100%_58%)]" />
              {roleLabel}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {userEmail || "admin@example.com"}
            </p>
          </div>
        </div>

        {/* Logout */}
        <Link
          href="/logout"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium",
            "text-muted-foreground border border-transparent",
            "transition-all duration-200",
            "hover:bg-red-500/[0.08] hover:text-red-400 hover:border-red-500/20"
          )}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </Link>
      </div>
    </div>
  );
}

/** Desktop sidebar */
export function AppSidebar({
  userEmail,
  role,
}: {
  userEmail?: string;
  role?: Role;
}) {
  return (
    <aside
      className={cn(
        "hidden md:flex h-full w-64 shrink-0 flex-col",
        // Glassmorphism sidebar
        "bg-[hsl(225_30%_7%/0.70)]",
        "backdrop-blur-2xl saturate-150",
        "border-r border-white/[0.05]",
        "shadow-[inset_-1px_0_0_hsl(210_40%_98%/0.04)]"
      )}
    >
      <SidebarInner userEmail={userEmail} role={role} />
    </aside>
  );
}

/** Mobile hamburger nav */
export function MobileNav({
  userEmail,
  role,
}: {
  userEmail?: string;
  role?: Role;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open navigation menu"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            "left-0 top-0 h-full w-64 max-w-[80vw]",
            "translate-x-0 translate-y-0",
            "gap-0 rounded-none border-y-0 border-l-0 sm:rounded-none",
            "p-0",
            // Glassmorphism mobile drawer
            "bg-[hsl(225_30%_7%/0.85)] backdrop-blur-3xl",
            "border-r border-white/[0.06]"
          )}
        >
          <DialogTitle className="sr-only">Navigation menu</DialogTitle>
          <SidebarInner
            userEmail={userEmail}
            role={role}
            onNavigate={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
