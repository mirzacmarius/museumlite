"use client";

import { useI18n } from "@/locales/client";
import { Badge } from "@v1/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@v1/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@v1/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { cn } from "@v1/ui/utils";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Building2,
  MapPin,
  Package,
} from "lucide-react";

interface LocationUtilizationCardProps {
  data: {
    summary: {
      totalLocations: number;
      locationsWithCapacity: number;
      totalCapacity: number;
      totalOccupied: number;
      utilizationPercentage: number;
    };
    byType: Array<{
      type: string;
      count: number;
      withCapacity: number;
      totalCapacity: number;
      totalOccupied: number;
      utilizationPercentage: number;
    }>;
    topUtilized: Array<{
      id: string;
      name: string;
      type: string;
      capacity: number;
      occupied: number;
      utilizationPercentage: number;
      path: string;
    }>;
    underutilized: Array<{
      id: string;
      name: string;
      type: string;
      capacity: number;
      occupied: number;
      utilizationPercentage: number;
      path: string;
    }>;
    atCapacity: Array<{
      id: string;
      name: string;
      type: string;
      capacity: number;
      occupied: number;
      path: string;
    }>;
  };
}

function getUtilizationColor(percentage: number): string {
  if (percentage >= 90) return "text-red-500 bg-red-500/10 ring-red-500/20";
  if (percentage >= 70)
    return "text-amber-500 bg-amber-500/10 ring-amber-500/20";
  if (percentage >= 40) return "text-blue-500 bg-blue-500/10 ring-blue-500/20";
  return "text-emerald-500 bg-emerald-500/10 ring-emerald-500/20";
}

function getProgressColor(percentage: number): string {
  if (percentage >= 90) return "bg-red-500";
  if (percentage >= 70) return "bg-amber-500";
  if (percentage >= 40) return "bg-blue-500";
  return "bg-emerald-500";
}

export function LocationUtilizationCard({
  data,
}: LocationUtilizationCardProps) {
  const t = useI18n();
  return (
    <Card className="bg-muted/30 border-white/10 backdrop-blur-sm h-full flex flex-col col-span-1 lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <MapPin className="size-4" />
          {t("analytics.locations.title")}
        </CardTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          <div className="bg-muted/50 border border-border rounded-md p-2 text-center">
            <div className="text-lg font-bold text-foreground flex items-center justify-center gap-1">
              <Building2 className="size-3.5 text-muted-foreground" />
              {data.summary.totalLocations}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Total
            </div>
          </div>
          <div className="bg-muted/50 border border-border rounded-md p-2 text-center">
            <div className="text-lg font-bold text-foreground">
              {data.summary.locationsWithCapacity}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Tracked
            </div>
          </div>
          <div className="bg-muted/50 border border-border rounded-md p-2 text-center">
            <div className="text-lg font-bold text-foreground flex items-center justify-center gap-1">
              <Package className="size-3.5 text-muted-foreground" />
              {data.summary.totalOccupied}/{data.summary.totalCapacity}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Occupied
            </div>
          </div>
          <div
            className={cn(
              "border rounded-md p-2 text-center",
              data.summary.utilizationPercentage >= 90
                ? "bg-red-500/10 border-red-500/20"
                : data.summary.utilizationPercentage >= 70
                  ? "bg-amber-500/10 border-amber-500/20"
                  : "bg-emerald-500/10 border-emerald-500/20",
            )}
          >
            <div
              className={cn(
                "text-lg font-bold",
                data.summary.utilizationPercentage >= 90
                  ? "text-red-500"
                  : data.summary.utilizationPercentage >= 70
                    ? "text-amber-500"
                    : "text-emerald-500",
              )}
            >
              {data.summary.utilizationPercentage}%
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Overall
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto pt-2">
        <Tabs defaultValue="overview" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-4 h-8 bg-muted/50">
            <TabsTrigger value="overview" className="text-xs h-7">
              {t("analytics.locations.overview")}
            </TabsTrigger>
            <TabsTrigger value="high" className="text-xs h-7 gap-1">
              <ArrowUp className="size-3" />
              High
              {data.atCapacity.length > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 px-1 text-[9px] bg-red-500/20 text-red-500"
                >
                  {data.atCapacity.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="low" className="text-xs h-7 gap-1">
              <ArrowDown className="size-3" />
              Low
            </TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs h-7 gap-1">
              <AlertTriangle className="size-3" />
              At Cap
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 mt-3">
            <div className="space-y-3">
              {data.byType.slice(0, 8).map((item) => (
                <div key={item.type} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground capitalize">
                      {item.type}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {item.totalOccupied}/{item.totalCapacity}{" "}
                      <span
                        className={cn(
                          "ml-1",
                          item.utilizationPercentage >= 90
                            ? "text-red-500"
                            : item.utilizationPercentage >= 70
                              ? "text-amber-500"
                              : "text-muted-foreground",
                        )}
                      >
                        ({item.utilizationPercentage}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        getProgressColor(item.utilizationPercentage),
                      )}
                      style={{ width: `${item.utilizationPercentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="high" className="flex-1 mt-3">
            <div className="rounded-md border border-border bg-background/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border bg-muted/30">
                    <TableHead className="h-7 text-[10px] uppercase font-semibold">
                      Location
                    </TableHead>
                    <TableHead className="h-7 text-[10px] uppercase font-semibold text-right">
                      Usage
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topUtilized.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="h-16 text-center text-xs text-muted-foreground"
                      >
                        No high utilization locations
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.topUtilized.slice(0, 8).map((loc) => (
                      <TableRow
                        key={loc.id}
                        className="hover:bg-muted/30 border-border"
                      >
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium">
                              {loc.name}
                            </span>
                            <span
                              className="text-[10px] text-muted-foreground truncate max-w-[200px]"
                              title={loc.path}
                            >
                              {loc.path}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] h-5 px-1.5 border-0 ring-1 ring-inset font-mono",
                              getUtilizationColor(loc.utilizationPercentage),
                            )}
                          >
                            {loc.occupied}/{loc.capacity} (
                            {loc.utilizationPercentage}%)
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="low" className="flex-1 mt-3">
            <div className="rounded-md border border-border bg-background/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border bg-muted/30">
                    <TableHead className="h-7 text-[10px] uppercase font-semibold">
                      Location
                    </TableHead>
                    <TableHead className="h-7 text-[10px] uppercase font-semibold text-right">
                      Usage
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.underutilized.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="h-16 text-center text-xs text-muted-foreground"
                      >
                        No underutilized locations
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.underutilized.slice(0, 8).map((loc) => (
                      <TableRow
                        key={loc.id}
                        className="hover:bg-muted/30 border-border"
                      >
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium">
                              {loc.name}
                            </span>
                            <span
                              className="text-[10px] text-muted-foreground truncate max-w-[200px]"
                              title={loc.path}
                            >
                              {loc.path}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] h-5 px-1.5 border-0 ring-1 ring-inset font-mono",
                              getUtilizationColor(loc.utilizationPercentage),
                            )}
                          >
                            {loc.occupied}/{loc.capacity} (
                            {loc.utilizationPercentage}%)
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="flex-1 mt-3">
            {data.atCapacity.length === 0 ? (
              <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">
                <div className="text-center">
                  <AlertTriangle className="size-6 mx-auto mb-2 text-emerald-500/50" />
                  No locations at capacity
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-red-500/20 bg-red-500/5 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-red-500/10 bg-red-500/10">
                      <TableHead className="h-7 text-[10px] uppercase font-semibold text-red-400">
                        Location
                      </TableHead>
                      <TableHead className="h-7 text-[10px] uppercase font-semibold text-red-400 text-right">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.atCapacity.slice(0, 8).map((loc) => (
                      <TableRow
                        key={loc.id}
                        className="hover:bg-red-500/10 border-red-500/10"
                      >
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium">
                              {loc.name}
                            </span>
                            <span
                              className="text-[10px] text-muted-foreground truncate max-w-[200px]"
                              title={loc.path}
                            >
                              {loc.path}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className="text-[10px] h-5 px-1.5 border-0 ring-1 ring-inset font-mono text-red-500 bg-red-500/10 ring-red-500/20"
                          >
                            {loc.occupied >= loc.capacity
                              ? "FULL"
                              : `${loc.occupied}/${loc.capacity}`}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
