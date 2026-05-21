"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import {
  ArrowDownToLine,
  BookOpen,
  CheckCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface CirculationListItem {
  _id: Id<"circulations">;
  dueDate: number;
  daysOverdue?: number;
  renewalCount: number;
  item?: { title: string } | null;
  account?: { firstName?: string; lastName?: string } | null;
  copy?: { barcode: string } | null;
}

interface CirculationTabsPanelProps {
  tCirc: (key: string, params?: { count: number }) => string;
  overdueItems: { page: CirculationListItem[] } | undefined;
  activeCheckouts: { page: CirculationListItem[] } | undefined;
  formatDate: (timestamp: number) => string;
  handleRenew: (circulationId: Id<"circulations">) => void;
  handleCheckin: (circulationId: Id<"circulations">) => void;
  isProcessing: boolean;
}

export function CirculationTabsPanel({
  tCirc,
  overdueItems,
  activeCheckouts,
  formatDate,
  handleRenew,
  handleCheckin,
  isProcessing,
}: CirculationTabsPanelProps) {
  return (
    <Tabs defaultValue="overdue" className="p-6">
      <TabsList>
        <TabsTrigger value="overdue">
          {tCirc("tabs.overdue")} ({overdueItems?.page.length ?? 0})
        </TabsTrigger>
        <TabsTrigger value="active">
          {tCirc("tabs.activeCheckouts")} ({activeCheckouts?.page.length ?? 0})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overdue" className="mt-4">
        {overdueItems === undefined ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : overdueItems.page.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2">
            <CheckCircle className="size-8 text-green-500" />
            <p className="text-muted-foreground">
              {tCirc("emptyState.noOverdue")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {overdueItems.page.map((item) => (
              <div
                key={item._id}
                className="flex items-center justify-between rounded-lg border border-destructive bg-destructive/5 p-4"
              >
                <div>
                  <p className="font-medium">{item.item?.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.account?.firstName} {item.account?.lastName} |{" "}
                    {item.copy?.barcode}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <Badge variant="destructive">
                      {tCirc("labels.daysOverdue", {
                        count: item.daysOverdue ?? 0,
                      })}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tCirc("labels.due")} {formatDate(item.dueDate)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRenew(item._id)}
                    disabled={isProcessing}
                  >
                    <RefreshCw className="mr-2 size-4" />
                    {tCirc("actions.renew")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="active" className="mt-4">
        {activeCheckouts === undefined ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : activeCheckouts.page.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2">
            <BookOpen className="size-8 text-muted-foreground" />
            <p className="text-muted-foreground">
              {tCirc("emptyState.noActiveCheckouts")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeCheckouts.page.map((item) => (
              <div
                key={item._id}
                className="flex items-center justify-between rounded-lg border border-border p-4"
              >
                <div>
                  <p className="font-medium">{item.item?.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.account?.firstName} {item.account?.lastName} |{" "}
                    {item.copy?.barcode}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm">
                      {tCirc("labels.due")} {formatDate(item.dueDate)}
                    </p>
                    {item.renewalCount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {tCirc("labels.renewed")}{" "}
                        {tCirc("labels.renewedTimes", {
                          count: item.renewalCount,
                        })}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRenew(item._id)}
                    disabled={isProcessing}
                  >
                    <RefreshCw className="mr-2 size-4" />
                    {tCirc("actions.renew")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleCheckin(item._id)}
                    disabled={isProcessing}
                  >
                    <ArrowDownToLine className="mr-2 size-4" />
                    {tCirc("actions.checkIn")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
