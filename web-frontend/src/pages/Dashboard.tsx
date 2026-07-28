import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Wallet,
  TrendingUp,
  Layers,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge, EmptyState } from "@/components/StatusPieces";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import {
  tradingApi,
  complianceApi,
  marketApi,
  apiErrorMessage,
  type Portfolio,
  type PortfolioHolding,
  type Order,
  type ComplianceStatusSummary,
  type MarketStatistics,
} from "@/services/api";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  sideTone,
} from "@/lib/format";

export function Dashboard() {
  const { user } = useAuth();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [compliance, setCompliance] = useState<ComplianceStatusSummary | null>(
    null,
  );
  const [marketStats, setMarketStats] = useState<MarketStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [portfolioRes, holdingsRes, ordersRes, complianceRes, statsRes] =
          await Promise.allSettled([
            tradingApi.portfolios(),
            tradingApi.holdings(),
            tradingApi.listOrders({ per_page: 5 }),
            complianceApi.myStatus(),
            marketApi.statistics({ days: 7 }),
          ]);

        if (!active) return;

        if (portfolioRes.status === "fulfilled")
          setPortfolios(portfolioRes.value.portfolios);
        if (holdingsRes.status === "fulfilled")
          setHoldings(holdingsRes.value.holdings);
        if (ordersRes.status === "fulfilled") setOrders(ordersRes.value.orders);
        if (complianceRes.status === "fulfilled")
          setCompliance(complianceRes.value);
        if (statsRes.status === "fulfilled" && !statsRes.value.error)
          setMarketStats(statsRes.value);

        if (portfolioRes.status === "rejected") {
          setError(apiErrorMessage(portfolioRes.reason));
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const totalValue = portfolios.reduce(
    (sum, p) => sum + (p.total_value || 0),
    0,
  );
  const totalPnl = portfolios.reduce((sum, p) => sum + (p.total_pnl || 0), 0);
  const totalCredits = portfolios.reduce(
    (sum, p) => sum + (p.total_credits || 0),
    0,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back, ${user?.first_name ?? ""}`}
        description="Here's where your portfolio, orders, and account status stand right now."
        actions={
          <Button asChild>
            <Link to="/trade">
              <Plus className="mr-1.5 h-4 w-4" />
              New order
            </Link>
          </Button>
        }
      />

      {compliance && !compliance.is_kyc_approved && (
        <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-medium">
                  Identity verification pending
                </p>
                <p className="text-xs text-muted-foreground">
                  Complete your profile to unlock trading and higher order
                  limits.
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/profile">Complete verification</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Portfolio value"
            value={formatCurrency(totalValue)}
            icon={Wallet}
            tone={totalPnl >= 0 ? "gain" : "loss"}
            trend={`${totalPnl >= 0 ? "+" : ""}${formatCurrency(totalPnl)} all-time`}
          />
          <StatCard
            label="Credits held"
            value={formatNumber(totalCredits, 0)}
            icon={Layers}
            hint="tCO₂e across all holdings"
          />
          <StatCard
            label="7-day avg. price"
            value={
              marketStats ? formatCurrency(marketStats.average_price) : "—"
            }
            icon={TrendingUp}
            hint={
              marketStats
                ? `${formatNumber(marketStats.trade_count, 0)} trades settled`
                : "No market data yet"
            }
          />
          <StatCard
            label="Account status"
            value={compliance?.is_kyc_approved ? "Verified" : "Pending"}
            icon={ShieldCheck}
            tone={compliance?.is_kyc_approved ? "gain" : "neutral"}
            hint={
              compliance ? `Risk tier: ${compliance.risk_level}` : undefined
            }
          />
        </div>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent orders</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/orders">
                View all
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No orders yet"
                description="Place your first order to start building a position."
                action={
                  <Button asChild size="sm">
                    <Link to="/trade">Place an order</Link>
                  </Button>
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Credit type</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Placed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">
                        {o.credit_type}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${sideTone(o.side)}`}
                        >
                          {o.side}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono-num">
                        {formatNumber(o.quantity, 0)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={o.status} />
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatDateTime(o.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top holdings</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : holdings.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No holdings yet"
                description="Credits you acquire will show up here."
              />
            ) : (
              <ul className="space-y-3">
                {holdings.slice(0, 6).map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {formatNumber(h.quantity, 0)} credits
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Avg. cost {formatCurrency(h.average_cost)}
                      </p>
                    </div>
                    <p
                      className={`font-mono-num text-sm ${h.total_pnl >= 0 ? "text-gain" : "text-loss"}`}
                    >
                      {h.total_pnl >= 0 ? "+" : ""}
                      {formatCurrency(h.total_pnl)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link to="/portfolio">View full portfolio</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Dashboard;
