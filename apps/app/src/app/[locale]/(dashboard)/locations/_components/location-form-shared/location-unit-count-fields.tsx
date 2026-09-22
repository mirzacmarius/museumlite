"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useScopedI18n } from "@/locales/client";
import { LOCATION_UNIT_COUNT_FIELDS } from "../../location-custom-fields";

interface LocationUnitCountFieldsProps {
  vitrineCount: string;
  wallCount: string;
  wallItemsPerWall: string;
  cabinetCount: string;
  shelfCount: string;
  onVitrineCountChange: (value: string) => void;
  onWallCountChange: (value: string) => void;
  onWallItemsPerWallChange: (value: string) => void;
  onCabinetCountChange: (value: string) => void;
  onShelfCountChange: (value: string) => void;
  gridClassName?: string;
  fieldWrapperClassName?: string;
  readOnly?: boolean;
}

export function LocationUnitCountFields({
  vitrineCount,
  wallCount,
  wallItemsPerWall,
  cabinetCount,
  shelfCount,
  onVitrineCountChange,
  onWallCountChange,
  onWallItemsPerWallChange,
  onCabinetCountChange,
  onShelfCountChange,
  gridClassName = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3",
  fieldWrapperClassName = "grid gap-2",
  readOnly = false,
}: LocationUnitCountFieldsProps) {
  const t = useScopedI18n("locations.form");

  const valueByKey = {
    vitrineCount,
    wallCount,
    cabinetCount,
    shelfCount,
  };
  const setterByKey = {
    vitrineCount: onVitrineCountChange,
    wallCount: onWallCountChange,
    cabinetCount: onCabinetCountChange,
    shelfCount: onShelfCountChange,
  };

  return (
    <div className="grid gap-3">
      <Label>{t("unitCountsLabel")}</Label>
      <div className={gridClassName}>
        {LOCATION_UNIT_COUNT_FIELDS.map((field) => (
          <div key={field.key} className={fieldWrapperClassName}>
            <Label htmlFor={field.key}>{t(field.labelKey)}</Label>
            <Input
              id={field.key}
              type="number"
              min="0"
              value={valueByKey[field.key]}
              onChange={(e) => setterByKey[field.key](e.target.value)}
              placeholder={t(field.placeholderKey)}
              readOnly={readOnly}
            />
          </div>
        ))}
        <div className={fieldWrapperClassName}>
          <Label htmlFor="wallItemsPerWall">{t("wallItemsPerWallLabel")}</Label>
          <Input
            id="wallItemsPerWall"
            type="number"
            min="1"
            value={wallItemsPerWall}
            onChange={(e) => onWallItemsPerWallChange(e.target.value)}
            placeholder={t("wallItemsPerWallPlaceholder")}
            readOnly={readOnly}
          />
        </div>
      </div>
    </div>
  );
}
