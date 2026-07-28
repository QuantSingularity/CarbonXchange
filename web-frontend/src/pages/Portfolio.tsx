import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Wallet,
  TrendingUp,
  Layers,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RTooltip,
} from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState, ErrorState } from "@/components/StatusPieces";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  tradingApi,
  apiErrorMessage,
  type Portfolio as PortfolioType,
  type PortfolioHolding,
} from "@/services/api";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function Portfolio() {
  const [portfolios, setPortfolios] = useState<PortfolioType[]>([]);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, hRes] = await Promise.all([
        tradingApi.portfolios(),
        tradingApi.holdings(),
      ]);
      setPortfolios(pRes.portfolios);
      setHoldings(hRes.holdings);
    } catch (err) {
      setError(apiErrorMessage(err, "We couldn't load your portfolio."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totalValue = portfolios.reduce((s, p) => s + (p.total_value || 0), 0);
  const totalPnl = portfolios.reduce((s, p) => s + (p.total_pnl || 0), 0);
  const totalCredits = portfolios.reduce(
    (s, p) => s + (p.total_credits || 0),
    0,
  );

  const chartData = holdings
    .filter((h) => (h.current_value ?? 0) > 0)
    .map((h, i) => ({
      name: h.vintage_year ? `Vintage ${h.vintage_year}` : `Holding ${i + 1}`,
      value: h.current_value ?? 0,
    }));

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) return <ErrorState description={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        eyebrow="Portfolio"
        title="Your holdings"
        description="Everything you currently hold, its cost basis, and unrealized performance."
        actions={
          <Button asChild variant="outline">
            <Link to="/transactions">View transaction history</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total value"
          value={formatCurrency(totalValue)}
          icon={Wallet}
        />
        <StatCard
          label="Unrealized P&amp;L"
          value={`${totalPnl >= 0 ? "+" : ""}${formatCurrency(totalPnl)}`}
          icon={TrendingUp}
          tone={totalPnl >= 0 ? "gain" : "loss"}
        />
        <StatCard
          label="Credits held"
          value={formatNumber(totalCredits, 0)}
          icon={Layers}
          hint="tCO₂e"
        />
        <StatCard
          label="Holdings"
          value={String(holdings.length)}
          icon={PieChartIcon}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Holdings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {holdings.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={Wallet}
                  title="No holdings yet"
                  description="Buy your first credits from the trade desk to see them here."
                  action={
                    <Button asChild size="sm">
                      <Link to="/trade">Go to trade desk</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vintage</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Avg. cost</TableHead>
                    <TableHead>Current price</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead className="text-right">P&amp;L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{h.vintage_year || "—"}</TableCell>
                      <TableCell className="font-mono-num">
                        {formatNumber(h.quantity, 0)}
                      </TableCell>
                      <TableCell className="font-mono-num">
                        {formatCurrency(h.average_cost, h.currency)}
                      </TableCell>
                      <TableCell className="font-mono-num">
                        {h.current_price
                          ? formatCurrency(h.current_price, h.currency)
                          : "—"}
                      </TableCell>
                      <TableCell className="font-mono-num">
                        {h.current_value
                          ? formatCurrency(h.current_value, h.currency)
                          : "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono-num ${h.total_pnl >= 0 ? "text-gain" : "text-loss"}`}
                      >
                        {h.total_pnl >= 0 ? "+" : ""}
                        {formatCurrency(h.total_pnl, h.currency)}
                        <span className="ml-1 text-xs">
                          ({h.pnl_percentage >= 0 ? "+" : ""}
                          {h.pnl_percentage.toFixed(1)}%)
                        </span>
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
            <CardTitle className="text-base">Allocation by vintage</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nothing to chart yet.
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <RTooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <ul className="mt-2 space-y-1.5">
              {chartData.map((d, i) => (
                <li
                  key={d.name}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    {d.name}
                  </span>
                  <span className="font-mono-num">
                    {formatCurrency(d.value)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {portfolios.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Portfolios</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Holdings</TableHead>
                  <TableHead className="text-right">Last valued</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {portfolios.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {p.portfolio_type}
                    </TableCell>
                    <TableCell className="font-mono-num">
                      {formatCurrency(p.total_value, p.base_currency)}
                    </TableCell>
                    <TableCell className="font-mono-num">
                      {p.number_of_holdings}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {p.last_valuation_at
                        ? formatDate(p.last_valuation_at)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default Portfolio;
