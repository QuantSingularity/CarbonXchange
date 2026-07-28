import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Search, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/StatusPieces";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  marketApi,
  tradingApi,
  apiErrorMessage,
  type MarketData,
  type OrderBookDepth,
  type Trade as TradeRecord,
  type OrderSide,
  type OrderType,
} from "@/services/api";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatRelativeTime } from "@/lib/format";

const POLL_MS = 15000;

export function Trade() {
  const [searchParams] = useSearchParams();
  const [symbol, setSymbol] = useState(searchParams.get("credit_type") || "");
  const [symbolInput, setSymbolInput] = useState(symbol);

  const [ticker, setTicker] = useState<MarketData | null>(null);
  const [depth, setDepth] = useState<OrderBookDepth | null>(null);
  const [recentTrades, setRecentTrades] = useState<TradeRecord[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);

  const [orderType, setOrderType] = useState<OrderType>("market");
  const [side, setSide] = useState<OrderSide>("buy");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [vintageYear, setVintageYear] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMarket = async (sym: string) => {
    if (!sym.trim()) {
      setTicker(null);
      setDepth(null);
      setRecentTrades([]);
      return;
    }
    setMarketLoading(true);
    setMarketError(null);
    try {
      const [tickerRes, depthRes, tradesRes] = await Promise.allSettled([
        marketApi.ticker(sym),
        marketApi.depth(sym, 8),
        marketApi.recentTrades({ credit_type: sym, limit: 10 }),
      ]);
      setTicker(tickerRes.status === "fulfilled" ? tickerRes.value : null);
      setDepth(depthRes.status === "fulfilled" ? depthRes.value : null);
      setRecentTrades(
        tradesRes.status === "fulfilled" ? tradesRes.value.trades : [],
      );
      if (tickerRes.status === "rejected" && depthRes.status === "rejected") {
        setMarketError("No market data found for this symbol yet.");
      }
    } finally {
      setMarketLoading(false);
    }
  };

  useEffect(() => {
    loadMarket(symbol);
    if (pollRef.current) clearInterval(pollRef.current);
    if (symbol.trim()) {
      pollRef.current = setInterval(() => loadMarket(symbol), POLL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [symbol]);

  const handleSymbolSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSymbol(symbolInput.trim());
  };

  const handleOrderSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const qty = Number(quantity);
    if (!symbol.trim()) {
      setFormError(
        "Enter a credit type / symbol above before placing an order.",
      );
      return;
    }
    if (!qty || qty <= 0) {
      setFormError("Enter a quantity greater than zero.");
      return;
    }
    if (orderType !== "market" && (!price || Number(price) <= 0)) {
      setFormError("Enter a limit price for non-market orders.");
      return;
    }

    setSubmitting(true);
    try {
      const { order } = await tradingApi.createOrder({
        order_type: orderType,
        side,
        quantity: qty,
        credit_type: symbol.trim(),
        price: orderType !== "market" ? Number(price) : undefined,
        vintage_year: vintageYear ? Number(vintageYear) : undefined,
      });
      toast.success(
        `${side === "buy" ? "Buy" : "Sell"} order ${order.order_id} placed.`,
      );
      setQuantity("");
      setPrice("");
      loadMarket(symbol);
    } catch (err) {
      setFormError(apiErrorMessage(err, "We couldn't place that order."));
    } finally {
      setSubmitting(false);
    }
  };

  const changePositive = (ticker?.change_percentage_24h ?? 0) >= 0;

  return (
    <div>
      <PageHeader
        eyebrow="Trade desk"
        title="Place an order"
        description="Look up a credit type, review depth and recent prints, then submit your order."
      />

      <form onSubmit={handleSymbolSubmit} className="mb-6 flex max-w-lg gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 font-mono-num"
            placeholder="e.g. reforestation, VCS-REDD-2024…"
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline">
          Look up
        </Button>
      </form>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {!symbol.trim() ? (
            <EmptyState
              icon={Search}
              title="Search for a credit type"
              description="Try a project type like “reforestation” or a listed symbol to see live pricing and depth."
            />
          ) : (
            <>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <p className="font-mono-num text-xs uppercase tracking-wide text-muted-foreground">
                      {symbol}
                    </p>
                    <p className="mt-1 font-mono-num text-2xl font-semibold">
                      {ticker
                        ? formatCurrency(ticker.value, ticker.currency)
                        : marketLoading
                          ? "…"
                          : "—"}
                    </p>
                  </div>
                  {ticker && (
                    <div
                      className={cn(
                        "flex items-center gap-1.5 font-mono-num text-sm font-medium",
                        changePositive ? "text-gain" : "text-loss",
                      )}
                    >
                      {changePositive ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {formatNumber(ticker.change_percentage_24h ?? 0)}% (24h)
                    </div>
                  )}
                  <div className="flex gap-6 text-xs text-muted-foreground">
                    <div>
                      <p>24h high</p>
                      <p className="mt-0.5 font-mono-num text-foreground">
                        {ticker?.high_24h
                          ? formatCurrency(ticker.high_24h)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p>24h low</p>
                      <p className="mt-0.5 font-mono-num text-foreground">
                        {ticker?.low_24h ? formatCurrency(ticker.low_24h) : "—"}
                      </p>
                    </div>
                    <div>
                      <p>24h volume</p>
                      <p className="mt-0.5 font-mono-num text-foreground">
                        {ticker?.volume ? formatNumber(ticker.volume, 0) : "—"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {marketError && (
                <p className="text-sm text-muted-foreground">{marketError}</p>
              )}

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Order book</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!depth ||
                    (depth.bids.length === 0 && depth.asks.length === 0) ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        No open orders for this symbol.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <p className="mb-1 text-xs font-medium text-loss">
                            Asks
                          </p>
                          {depth.asks
                            .slice(0, 6)
                            .reverse()
                            .map((a, i) => (
                              <div
                                key={i}
                                className="flex justify-between font-mono-num text-xs"
                              >
                                <span className="text-loss">
                                  {formatCurrency(a.price)}
                                </span>
                                <span className="text-muted-foreground">
                                  {formatNumber(a.quantity, 0)}
                                </span>
                              </div>
                            ))}
                        </div>
                        <div className="border-t border-border" />
                        <div>
                          <p className="mb-1 text-xs font-medium text-gain">
                            Bids
                          </p>
                          {depth.bids.slice(0, 6).map((b, i) => (
                            <div
                              key={i}
                              className="flex justify-between font-mono-num text-xs"
                            >
                              <span className="text-gain">
                                {formatCurrency(b.price)}
                              </span>
                              <span className="text-muted-foreground">
                                {formatNumber(b.quantity, 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Recent trades</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {recentTrades.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        No recent prints.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Price</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead className="text-right">When</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentTrades.map((t) => (
                            <TableRow key={t.id}>
                              <TableCell className="font-mono-num">
                                {formatCurrency(t.price)}
                              </TableCell>
                              <TableCell className="font-mono-num">
                                {formatNumber(t.quantity, 0)}
                              </TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">
                                {formatRelativeTime(t.executed_at)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>

        <Card className="h-fit lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle className="text-base">Order entry</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-md bg-secondary p-1">
              {(["buy", "sell"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className={cn(
                    "rounded-sm py-2 text-sm font-semibold capitalize transition-colors",
                    side === s
                      ? s === "buy"
                        ? "bg-gain text-white"
                        : "bg-loss text-white"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            <form onSubmit={handleOrderSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Order type</Label>
                <Select
                  value={orderType}
                  onValueChange={(v) => setOrderType(v as OrderType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="market">Market</SelectItem>
                    <SelectItem value="limit">Limit</SelectItem>
                    <SelectItem value="stop">Stop</SelectItem>
                    <SelectItem value="stop_limit">Stop limit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="quantity">Quantity (tCO&#8322;e)</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="100"
                />
              </div>

              {orderType !== "market" && (
                <div className="space-y-1.5">
                  <Label htmlFor="price">Limit price (USD)</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="any"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="12.50"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="vintage">
                  Vintage year{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="vintage"
                  type="number"
                  value={vintageYear}
                  onChange={(e) => setVintageYear(e.target.value)}
                  placeholder="2024"
                />
              </div>

              {formError && (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {formError}
                </p>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className={cn(
                  "w-full",
                  side === "sell" && "bg-loss text-white hover:bg-loss/90",
                )}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `${side === "buy" ? "Buy" : "Sell"} ${symbol || "credits"}`
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Trade;
