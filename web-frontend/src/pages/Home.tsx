import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Sprout,
  Wind,
  Waves,
  Flame,
  ShieldCheck,
  ScanSearch,
  Repeat,
  BadgeCheck,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { marketApi, type MarketStatistics } from "@/services/api";
import { formatCurrency, formatNumber } from "@/lib/format";

const steps = [
  {
    n: "01",
    title: "Discover verified projects",
    body: "Screen reforestation, renewable energy, methane capture, and blue-carbon projects by standard, vintage, and verification status.",
    icon: ScanSearch,
  },
  {
    n: "02",
    title: "Trade with transparent pricing",
    body: "Place market or limit orders against a live order book, with fees and settlement disclosed before you confirm.",
    icon: Repeat,
  },
  {
    n: "03",
    title: "Retire and report",
    body: "Retire credits permanently on an auditable ledger and export the records your compliance team needs.",
    icon: BadgeCheck,
  },
];

const projectTypes = [
  { label: "Reforestation", icon: Sprout },
  { label: "Renewable energy", icon: Wind },
  { label: "Blue carbon", icon: Waves },
  { label: "Methane capture", icon: Flame },
];

const frameworks = ["CORSIA", "EU ETS", "Article 6", "TCFD", "SEC Climate"];

export function Home() {
  const [stats, setStats] = useState<MarketStatistics | null>(null);

  useEffect(() => {
    let active = true;
    marketApi
      .statistics({ days: 30 })
      .then((data) => {
        if (active && !data.error) setStats(data);
      })
      .catch(() => {
        /* market may be empty on a fresh install - the hero still reads fine without it */
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-grain opacity-40" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-24 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="animate-fade-up">
              <p className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 font-mono-num text-xs text-muted-foreground">
                Atmospheric CO&#8322; · 428 ppm and rising
              </p>
              <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                A regulated exchange for the credits that offset it.
              </h1>
              <p className="mt-5 max-w-lg text-base text-muted-foreground sm:text-lg">
                CarbonXchange connects verified project developers, corporates,
                and institutional traders in one order book - with KYC/AML
                screening, audit-ready records, and permanent retirement built
                into every trade.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link to="/register">
                    Open an account
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/marketplace">Browse the marketplace</Link>
                </Button>
              </div>

              <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-6">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    30-day avg. price
                  </dt>
                  <dd className="mt-1 font-mono-num text-lg font-semibold">
                    {stats ? formatCurrency(stats.average_price) : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Trades settled
                  </dt>
                  <dd className="mt-1 font-mono-num text-lg font-semibold">
                    {stats ? formatNumber(stats.trade_count, 0) : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Volume (tCO&#8322;e)
                  </dt>
                  <dd className="mt-1 font-mono-num text-lg font-semibold">
                    {stats ? formatNumber(stats.total_volume, 0) : "-"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="relative mx-auto aspect-[4/3] w-full max-w-lg">
              <svg
                viewBox="0 0 400 300"
                className="h-full w-full"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="riseFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity="0.18"
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity="0"
                    />
                  </linearGradient>
                </defs>
                {[60, 110, 160, 210, 260].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    y1={y}
                    x2="400"
                    y2={y}
                    stroke="hsl(var(--border))"
                    strokeWidth="1"
                  />
                ))}
                <path
                  d="M0 260 C 60 250, 90 240, 130 225 S 190 190, 230 165 S 300 110, 340 80 S 390 45, 400 30 L400 300 L0 300 Z"
                  fill="url(#riseFill)"
                />
                <path
                  d="M0 260 C 60 250, 90 240, 130 225 S 190 190, 230 165 S 300 110, 340 80 S 390 45, 400 30"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2.5"
                  className="keeling-line"
                  pathLength={1000}
                />
                <circle cx="400" cy="30" r="4.5" fill="hsl(var(--accent))" />
              </svg>
              <p className="absolute right-0 top-2 font-mono-num text-[11px] text-muted-foreground">
                Keeling curve, Mauna Loa Observatory - the reason this market
                exists
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="max-w-2xl">
          <p className="font-mono-num text-xs uppercase tracking-wider text-muted-foreground">
            How it works
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            From verified project to retired credit.
          </h2>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.n} className="rounded-lg border border-border p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" />
                </span>
                <span className="font-mono-num text-sm text-muted-foreground">
                  {step.n}
                </span>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Project types */}
      <section className="border-y border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-xl">
              <p className="font-mono-num text-xs uppercase tracking-wider text-muted-foreground">
                Verified supply
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Every credit traces back to a real, audited project.
              </h2>
            </div>
            <Button asChild variant="outline">
              <Link to="/marketplace">
                View live listings
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {projectTypes.map((t) => (
              <Card key={t.label}>
                <CardContent className="flex flex-col items-start gap-3 p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <t.icon className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-medium">{t.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance */}
      <section
        id="compliance"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="font-mono-num text-xs uppercase tracking-wider text-muted-foreground">
              Built for regulated markets
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Compliance isn&rsquo;t an afterthought - it&rsquo;s the ledger.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Every account passes KYC/AML screening before it can trade. Every
              trade, retirement, and report is timestamped and retrievable, so
              your audit trail is never reconstructed after the fact.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {frameworks.map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-border px-3 py-1 font-mono-num text-xs text-muted-foreground"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <p className="mt-3 text-sm font-medium">
                  Identity &amp; AML screening
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Risk-tiered onboarding before any order can be placed.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <BadgeCheck className="h-5 w-5 text-primary" />
                <p className="mt-3 text-sm font-medium">
                  Immutable retirement ledger
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Retired credits can never be re-traded or double-counted.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <TrendingUp className="h-5 w-5 text-primary" />
                <p className="mt-3 text-sm font-medium">
                  Live market surveillance
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pricing, depth, and volume tracked across every symbol.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <ScanSearch className="h-5 w-5 text-primary" />
                <p className="mt-3 text-sm font-medium">
                  Regulator-ready reporting
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Export filings mapped to the framework that requires them.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-primary">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-primary-foreground sm:text-4xl">
            Ready to put a price on impact?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
            Open an account in minutes and start discovering verified carbon
            projects today.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/register">
                Get started
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
