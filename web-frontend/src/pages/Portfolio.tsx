import {
  DollarSign,
  Loader2,
  Package,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "../components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { getMyOrders, getPortfolio } from "../services/api";

interface Holding {
  creditId: string;
  name: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  value: number;
  profitLoss: number;
  profitLossPercent: number;
}

interface Order {
  id: string;
  creditId: string;
  creditName: string;
  orderType: "buy" | "sell";
  quantity: number;
  price: number;
  status: string;
  createdAt: string;
}

const Portfolio: React.FC = () => {
  const [portfolio, setPortfolio] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [portfolioResponse, ordersResponse] = await Promise.all([
        getPortfolio(),
        getMyOrders(),
      ]);

      setPortfolio(portfolioResponse.data || portfolioResponse);
      setOrders(ordersResponse.data || []);
    } catch (error) {
      console.error("Failed to load portfolio data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalProfitLoss =
    portfolio?.holdings?.reduce(
      (sum: number, h: Holding) => sum + h.profitLoss,
      0,
    ) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Portfolio</h1>
        <p className="text-muted-foreground">
          Manage your carbon credit holdings
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${portfolio?.totalValue?.toFixed(2) || "0.00"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {portfolio?.totalCredits?.toLocaleString() || "0"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total P/L</CardTitle>
            {totalProfitLoss >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${totalProfitLoss >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              ${Math.abs(totalProfitLoss).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="holdings" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="holdings">Holdings</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="holdings" className="space-y-4">
          {portfolio?.holdings && portfolio.holdings.length > 0 ? (
            portfolio.holdings.map((holding: Holding) => (
              <Card key={holding.creditId}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{holding.name}</CardTitle>
                      <CardDescription>
                        {holding.quantity} credits @ ${holding.averagePrice}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        holding.profitLoss >= 0 ? "default" : "destructive"
                      }
                    >
                      {holding.profitLoss >= 0 ? "+" : ""}$
                      {holding.profitLoss.toFixed(2)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Current Price</p>
                      <p className="font-semibold">${holding.currentPrice}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Value</p>
                      <p className="font-semibold">
                        ${holding.value.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">P/L %</p>
                      <p
                        className={`font-semibold ${holding.profitLossPercent >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {holding.profitLossPercent >= 0 ? "+" : ""}
                        {holding.profitLossPercent.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Quantity</p>
                      <p className="font-semibold">{holding.quantity}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No holdings yet. Start trading to build your portfolio!
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          {orders && orders.length > 0 ? (
            orders.map((order) => (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {order.creditName}
                      </CardTitle>
                      <CardDescription>
                        {new Date(order.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge
                        variant={
                          order.orderType === "buy" ? "default" : "secondary"
                        }
                      >
                        {order.orderType.toUpperCase()}
                      </Badge>
                      <Badge
                        variant={
                          order.status === "completed"
                            ? "default"
                            : order.status === "pending"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Quantity</p>
                      <p className="font-semibold">{order.quantity}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Price</p>
                      <p className="font-semibold">${order.price}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-semibold">
                        ${(order.quantity * order.price).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No orders yet. Place your first order to get started!
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Portfolio;
