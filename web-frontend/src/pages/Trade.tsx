import { ArrowLeftRight, Loader2 } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { useAuth } from "../contexts/AuthContext";
import {
  createOrder,
  getCarbonCreditById,
  getCarbonCredits,
} from "../services/api";

const Trade: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const creditId = searchParams.get("creditId");

  const [credit, setCredit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orderType, setOrderType] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadCredit = useCallback(async () => {
    try {
      if (creditId) {
        const response = await getCarbonCreditById(creditId);
        setCredit(response.data || response);
      } else {
        const response = await getCarbonCredits();
        const credits = response.data || [];
        if (credits.length > 0) {
          setCredit(credits[0]);
        }
      }
    } catch (error) {
      console.error("Failed to load credit:", error);
      setError("Failed to load carbon credit information");
    } finally {
      setLoading(false);
    }
  }, [creditId]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    loadCredit();
  }, [isAuthenticated, loadCredit, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!quantity || parseInt(quantity, 10) <= 0) {
      setError("Please enter a valid quantity");
      return;
    }

    if (!credit) {
      setError("No carbon credit selected");
      return;
    }

    setSubmitting(true);

    try {
      await createOrder({
        creditId: credit.id,
        quantity: parseInt(quantity, 10),
        orderType,
        price: credit.price,
      });

      setSuccess(
        `Successfully placed ${orderType} order for ${quantity} credits`,
      );
      setQuantity("");

      setTimeout(() => {
        navigate("/portfolio");
      }, 2000);
    } catch (err: any) {
      setError(
        err.response?.data?.message || `Failed to place ${orderType} order`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!credit) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No carbon credit selected</p>
        <Button onClick={() => navigate("/market")} className="mt-4">
          Browse Market
        </Button>
      </div>
    );
  }

  const totalCost = credit.price * (parseInt(quantity, 10) || 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Trade Carbon Credits</h1>
        <p className="text-muted-foreground">
          Buy or sell verified carbon credits
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Credit Information</CardTitle>
            <CardDescription>
              Details about the selected carbon credit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg">{credit.name}</h3>
              <p className="text-sm text-muted-foreground">{credit.location}</p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium">{credit.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price:</span>
                <span className="font-medium">${credit.price}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Available:</span>
                <span className="font-medium">
                  {credit.available?.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vintage:</span>
                <span className="font-medium">{credit.vintage}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Standard:</span>
                <span className="font-medium">
                  {credit.verificationStandard}
                </span>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                {credit.description}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Place Order</CardTitle>
            <CardDescription>Enter your order details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>Order Type</Label>
                <RadioGroup
                  value={orderType}
                  onValueChange={(value) =>
                    setOrderType(value as "buy" | "sell")
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="buy" id="buy" />
                    <Label htmlFor="buy" className="cursor-pointer">
                      Buy
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sell" id="sell" />
                    <Label htmlFor="sell" className="cursor-pointer">
                      Sell
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max={credit.available}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  required
                  disabled={submitting}
                />
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Unit Price:</span>
                  <span className="font-medium">${credit.price}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Quantity:</span>
                  <span className="font-medium">{quantity || 0}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total:</span>
                  <span>${totalCost.toFixed(2)}</span>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                Place {orderType.charAt(0).toUpperCase() +
                  orderType.slice(1)}{" "}
                Order
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Trade;
