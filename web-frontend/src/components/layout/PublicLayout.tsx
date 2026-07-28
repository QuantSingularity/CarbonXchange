import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Marketplace", href: "/marketplace" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Compliance", href: "/#compliance" },
];

export function PublicLayout() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            {isAuthenticated ? (
              <Button asChild size="sm">
                <Link to="/dashboard">
                  Go to dashboard
                  <ArrowUpRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/register">Get started</Link>
                </Button>
              </>
            )}
          </div>

          <button
            className="inline-flex items-center justify-center rounded-md p-2 text-foreground md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="border-t border-border/70 px-4 pb-4 pt-2 md:hidden">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-3 flex items-center gap-2">
              {isAuthenticated ? (
                <Button asChild size="sm" className="flex-1">
                  <Link to="/dashboard">Go to dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Link to="/login">Sign in</Link>
                  </Button>
                  <Button asChild size="sm" className="flex-1">
                    <Link to="/register">Get started</Link>
                  </Button>
                </>
              )}
              <ThemeToggle />
            </div>
          </div>
        )}
      </header>

      <main
        className={cn("flex-1", location.pathname !== "/" && "flex flex-col")}
      >
        <Outlet />
      </main>

      <footer className="border-t border-border/70 bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <Logo />
              <p className="mt-3 max-w-sm text-sm text-muted-foreground">
                A regulated marketplace for discovering, trading, and retiring
                verified carbon credits — built for institutions, corporates,
                and individual offsetters alike.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold">Platform</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link to="/marketplace" className="hover:text-foreground">
                    Marketplace
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="hover:text-foreground">
                    Open an account
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-foreground">
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold">Trust &amp; compliance</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>KYC / AML screening</li>
                <li>Verified project registries</li>
                <li>Immutable retirement ledger</li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-border/70 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
            <p>
              &copy; {new Date().getFullYear()} CarbonXchange. All rights
              reserved.
            </p>
            <p className="font-mono-num">
              Atmospheric CO&#8322; · 428 ppm and rising
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
