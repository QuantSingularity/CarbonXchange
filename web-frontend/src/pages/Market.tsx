import { Loader2, Search, TrendingUp } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { getCarbonCredits } from "../services/api";

interface CarbonCredit {
  id: string;
  name: string;
  type: string;
  price: number;
  available: number;
  totalIssued: number;
  vintage: number;
  verificationStandard: string;
  location: string;
  description: string;
}

const Market: React.FC = () => {
  const [credits, setCredits] = useState<CarbonCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  const loadCredits = async () => {
    try {
      const response = await getCarbonCredits();
      setCredits(response.data || []);
    } catch (error) {
      console.error("Failed to load credits:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCredits = credits.filter(
    (credit) =>
      credit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      credit.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      credit.location.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleTrade = (creditId: string) => {
    navigate(`/trade?creditId=${creditId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Carbon Credit Market</h1>
          <p className="text-muted-foreground">
            Browse and purchase verified carbon credits
          </p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search credits..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCredits.map((credit) => (
          <Card key={credit.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{credit.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {credit.location}
                  </CardDescription>
                </div>
                <Badge>{credit.type}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {credit.description}
              </p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Price</p>
                  <p className="font-semibold text-lg">${credit.price}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Available</p>
                  <p className="font-semibold">
                    {credit.available.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vintage</p>
                  <p className="font-semibold">{credit.vintage}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Standard</p>
                  <p className="font-semibold">{credit.verificationStandard}</p>
                </div>
              </div>

              <Button className="w-full" onClick={() => handleTrade(credit.id)}>
                <TrendingUp className="mr-2 h-4 w-4" />
                Trade
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCredits.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No carbon credits found matching your search.
          </p>
        </div>
      )}
    </div>
  );
};

export default Market;
