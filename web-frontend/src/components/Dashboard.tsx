import type React from "react";
import CarbonPriceChart from "./charts/CarbonPriceChart";
import TradingVolumeChart from "./charts/TradingVolumeChart";
import MarketStats from "./MarketStats";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

const Dashboard: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">
            CarbonXchange Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time carbon credit market overview
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MarketStats />
        </div>

        <Tabs defaultValue="price" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="price">Carbon Credit Price</TabsTrigger>
            <TabsTrigger value="volume">Trading Volume</TabsTrigger>
          </TabsList>

          <TabsContent value="price">
            <Card>
              <CardHeader>
                <CardTitle>Carbon Credit Price</CardTitle>
                <CardDescription>
                  Live-updating chart of carbon credit prices over time
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-[400px]">
                  <CarbonPriceChart />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="volume">
            <Card>
              <CardHeader>
                <CardTitle>Trading Volume</CardTitle>
                <CardDescription>
                  Live-updating chart of carbon credit trading volume
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-[400px]">
                  <TradingVolumeChart />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
