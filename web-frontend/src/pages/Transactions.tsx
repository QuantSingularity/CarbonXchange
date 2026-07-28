import { useEffect, useState } from "react";
import { Receipt, Download } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, EmptyState, ErrorState } from "@/components/StatusPieces";
import { Card, CardContent } from "@/components/ui/card";
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
import { tradingApi, apiErrorMessage, type Trade } from "@/services/api";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";

export function Transactions() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await tradingApi.listTrades({ page, per_page: 20 });
      setTrades(res.trades);
      setPages(res.pages || 1);
    } catch (err) {
      setError(
        apiErrorMessage(err, "We couldn't load your transaction history."),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const exportCsv = () => {
    const header = [
      "Trade ID",
      "Credit type",
      "Quantity",
      "Price",
      "Total",
      "Status",
      "Executed at",
      "Settlement date",
    ];
    const rows = trades.map((t) => [
      t.trade_id,
      t.credit_type ?? "",
      t.quantity,
      t.price,
      t.total_value,
      t.status,
      t.executed_at,
      t.settlement_date ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "carbonxchange-transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Trading"
        title="Transaction history"
        description="Every settled trade tied to your account, ready to export for reporting."
        actions={
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={trades.length === 0}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-5">
              <ErrorState description={error} onRetry={load} />
            </div>
          ) : trades.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Receipt}
                title="No transactions yet"
                description="Settled trades will appear here once your orders fill."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trade ID</TableHead>
                  <TableHead>Credit type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Executed</TableHead>
                  <TableHead className="text-right">Settlement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono-num text-xs">
                      {t.trade_id}
                    </TableCell>
                    <TableCell className="font-medium">
                      {t.credit_type || "—"}
                    </TableCell>
                    <TableCell className="font-mono-num">
                      {formatNumber(t.quantity, 0)}
                    </TableCell>
                    <TableCell className="font-mono-num">
                      {formatCurrency(t.price, t.currency)}
                    </TableCell>
                    <TableCell className="font-mono-num">
                      {formatCurrency(t.total_value, t.currency)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(t.executed_at)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {t.settlement_date
                        ? formatDateTime(t.settlement_date)
                        : "Pending"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {Array.from({ length: pages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`h-8 w-8 rounded-md text-sm font-medium ${
                page === i + 1
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default Transactions;
