"use client";

import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const LOCATION_TYPE_KEYS = [
  "building",
  "room",
  "gallery",
  "storage",
  "cabinet",
  "shelf",
  "vault",
  "other",
] as const;

interface EditLocationDialogProps {
  locationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditLocationDialog({
  locationId,
  open,
  onOpenChange,
}: EditLocationDialogProps) {
  const t = useScopedI18n("locations.form");
  const tCommon = useScopedI18n("common");
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [capacity, setCapacity] = useState<string>("");
  const [temperature, setTemperature] = useState<string>("");
  const [humidity, setHumidity] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch the location details
  const location = useQuery(
    api.locations.get,
    open && locationId ? { locationId: locationId as Id<"locations"> } : "skip",
  );

  const updateLocation = useMutation(api.locations.update);

  useEffect(() => {
    if (location) {
      setName(location.name);
      setType(location.type);
      setAddress(location.address || "");
      setNotes(location.notes || "");
      setCapacity(location.capacity?.toString() || "");
      setTemperature(
        (location.customFields?.temperature as number)?.toString() || "",
      );
      setHumidity(
        (location.customFields?.humidity as number)?.toString() || "",
      );
    }
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) return;

    setIsSubmitting(true);
    try {
      const customFields: Record<
        string,
        string | number | boolean | string[] | null
      > = {
        ...((location.customFields || {}) as Record<
          string,
          string | number | boolean | string[] | null
        >),
      };
      if (temperature) {
        customFields.temperature = Number.parseFloat(temperature);
      }
      if (humidity) {
        customFields.humidity = Number.parseFloat(humidity);
      }

      await updateLocation({
        locationId: locationId as Id<"locations">,
        name,
        type,
        address: address || undefined,
        notes: notes || undefined,
        capacity: capacity ? Number.parseInt(capacity, 10) : undefined,
        customFields,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update location:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("editLocation")}</DialogTitle>
          <DialogDescription>{t("editDescription")}</DialogDescription>
        </DialogHeader>

        {!location ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t("nameLabel")}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("nameEnterPlaceholder")}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="type">{t("typeLabel")}</Label>
                <Select
                  value={type.toLowerCase()}
                  onValueChange={(val) =>
                    setType(val.charAt(0).toUpperCase() + val.slice(1))
                  }
                  required
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder={t("typePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPE_KEYS.map((typeKey) => (
                      <SelectItem key={typeKey} value={typeKey}>
                        {t(`locationTypes.${typeKey}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="address">{t("addressLabel")}</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t("addressEnterPlaceholder")}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="capacity">{t("capacityLabel")}</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="0"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder={t("capacityPlaceholder")}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="temperature">{t("temperatureLabel")}</Label>
                  <Input
                    id="temperature"
                    type="number"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    placeholder={t("temperaturePlaceholder")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="humidity">{t("humidityLabel")}</Label>
                  <Input
                    id="humidity"
                    type="number"
                    min="0"
                    max="100"
                    value={humidity}
                    onChange={(e) => setHumidity(e.target.value)}
                    placeholder={t("humidityPlaceholder")}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">{t("notesLabel")}</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("notesEnterPlaceholder")}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
