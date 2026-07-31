import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ListOrdered, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, EmptyState, ErrorState } from "@/components/StatusPieces";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { tradingApi, apiErrorMessage, type Order } from "@/services/api";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  sideTone,
} from "@/lib/format";

// Mirrors the backend's Order.is_active property exactly - "pending"
// orders haven't reached the book yet and the API rejects cancelling them.
const cancellable = new Set(["open", "partially_filled"]);

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await tradingApi.listOrders({
        page,
        per_page: 15,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      setOrders(res.orders);
      setPages(res.pages || 1);
    } catch (err) {
      setError(apiErrorMessage(err, "We couldn't load your orders."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  const handleCancel = async (orderId: string) => {
    setCancellingId(orderId);
    try {
      await tradingApi.cancelOrder(orderId);
      toast.success("Order cancelled.");
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "That order couldn't be cancelled."));
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Trading"
        title="Order history"
        description="Track the status of every order you've placed, and cancel anything still open."
      />

      <div className="mb-6 flex items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="partially_filled">Partially filled</SelectItem>
            <SelectItem value="filled">Filled</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
          ) : orders.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={ListOrdered}
                title="No orders yet"
                description="Orders you place from the trade desk will show up here."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Credit type</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Filled</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Placed</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono-num text-xs">
                      {o.order_id}
                    </TableCell>
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
                    <TableCell className="capitalize text-muted-foreground">
                      {o.order_type.replace("_", " ")}
                    </TableCell>
                    <TableCell className="font-mono-num">
                      {formatNumber(o.filled_quantity, 0)} /{" "}
                      {formatNumber(o.quantity, 0)}
                    </TableCell>
                    <TableCell className="font-mono-num">
                      {o.price ? formatCurrency(o.price) : "Market"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(o.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {cancellable.has(o.status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={cancellingId === o.order_id}
                          onClick={() => handleCancel(o.order_id)}
                        >
                          <X className="mr-1 h-3.5 w-3.5" />
                          Cancel
                        </Button>
                      )}
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

export default Orders;
