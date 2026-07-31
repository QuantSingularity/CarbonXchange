import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Store,
  CandlestickChart,
  ListOrdered,
  Wallet,
  Receipt,
  ShieldCheck,
  UserCircle,
  ShieldAlert,
  Menu,
  X,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { initials, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

const primaryNav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Marketplace", href: "/marketplace", icon: Store },
  { label: "Trade", href: "/trade", icon: CandlestickChart },
  { label: "Orders", href: "/orders", icon: ListOrdered },
  { label: "Portfolio", href: "/portfolio", icon: Wallet },
  { label: "Transactions", href: "/transactions", icon: Receipt },
  { label: "Compliance", href: "/compliance", icon: ShieldCheck },
];

const staffRoles = new Set(["admin", "compliance_officer", "auditor"]);

function SidebarLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const isStaff = user ? staffRoles.has(user.role) : false;

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {primaryNav.map(({ label, href, icon: Icon }) => (
        <NavLink
          key={href}
          to={href}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-rail-accent/15 text-rail-accent"
                : "text-rail-foreground/70 hover:bg-white/5 hover:text-rail-foreground",
            )
          }
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          {label}
        </NavLink>
      ))}

      <div className="my-2 border-t border-rail-border" />

      <NavLink
        to="/profile"
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive
              ? "bg-rail-accent/15 text-rail-accent"
              : "text-rail-foreground/70 hover:bg-white/5 hover:text-rail-foreground",
          )
        }
      >
        <UserCircle className="h-[18px] w-[18px] shrink-0" />
        Profile &amp; settings
      </NavLink>

      {isStaff && (
        <NavLink
          to="/admin"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-rail-accent/15 text-rail-accent"
                : "text-rail-foreground/70 hover:bg-white/5 hover:text-rail-foreground",
            )
          }
        >
          <ShieldAlert className="h-[18px] w-[18px] shrink-0" />
          Admin console
        </NavLink>
      )}
    </nav>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop rail - always dark, an instrument panel regardless of theme */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-rail-border bg-rail lg:flex">
        <Link
          to="/dashboard"
          className="flex h-16 items-center gap-2 border-b border-rail-border px-5"
        >
          <Logo className="[&_span]:text-rail-foreground" />
        </Link>
        <SidebarLinks />
        <div className="border-t border-rail-border p-3">
          <p className="px-2 font-mono-num text-[11px] text-rail-muted">
            Atmospheric CO&#8322; · 428 ppm
          </p>
        </div>
      </aside>

      {/* Mobile rail */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-64 flex-col bg-rail">
            <div className="flex h-16 items-center justify-between border-b border-rail-border px-5">
              <Logo className="[&_span]:text-rail-foreground" />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5 text-rail-foreground" />
              </button>
            </div>
            <SidebarLinks onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
          <button
            className="inline-flex items-center justify-center rounded-md p-2 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden lg:block" />

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm hover:bg-secondary">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-mono-num text-xs font-semibold text-primary-foreground">
                    {initials(user?.first_name, user?.last_name)}
                  </span>
                  <span className="hidden max-w-[140px] truncate font-medium sm:inline">
                    {user?.first_name}
                  </span>
                  <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:inline" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="truncate text-sm font-medium">
                    {user?.full_name}
                  </p>
                  <p className="truncate text-xs font-normal text-muted-foreground">
                    {user?.email}
                  </p>
                  <p className="mt-1 text-xs font-normal text-muted-foreground">
                    {humanize(user?.role)}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <UserCircle className="mr-2 h-4 w-4" />
                  Profile &amp; settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/compliance")}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Compliance status
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 bg-background">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
