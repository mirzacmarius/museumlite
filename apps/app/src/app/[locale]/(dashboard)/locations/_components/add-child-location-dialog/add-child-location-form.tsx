"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useScopedI18n } from "@/locales/client";
import { LocationImageField } from "../location-form-shared/location-image-field";
import { LocationTypeSelect } from "../location-form-shared/location-type-select";
import { LocationUnitCountFields } from "../location-form-shared/location-unit-count-fields";
import type { useAddChildLocationForm } from "./use-add-child-location-form";

type AddChildLocationFormState = ReturnType<typeof useAddChildLocationForm>;

interface AddChildLocationFormProps {
  form: AddChildLocationFormState;
}

export function AddChildLocationForm({ form }: AddChildLocationFormProps) {
  const t = useScopedI18n("locations.form");

  return (
    <div className="grid gap-4 py-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] lg:items-start">
      {form.error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive lg:col-span-2">
          {form.error}
        </div>
      )}

      <div className="grid gap-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">{t("nameLabel")}</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => form.setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="locationCode">{t("locationIdLabel")}</Label>
            <Input
              id="locationCode"
              value={form.locationCode}
              onChange={(e) => form.setLocationCode(e.target.value)}
              placeholder={t("locationIdPlaceholder")}
              required
              maxLength={50}
            />
          </div>
          <LocationTypeSelect
            value={form.type}
            onChange={form.setType}
            required
          />
          <div className="space-y-2">
            <Label htmlFor="address">{t("addressLabel")}</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => form.setAddress(e.target.value)}
              placeholder={t("addressPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="capacity">{t("capacityLabel")}</Label>
            <Input
              id="capacity"
              type="number"
              min="0"
              value={form.capacity}
              onChange={(e) => form.setCapacity(e.target.value)}
              placeholder={t("capacityPlaceholder")}
            />
          </div>
        </div>

        <LocationUnitCountFields
          vitrineCount={form.vitrineCount}
          wallCount={form.wallCount}
          wallItemsPerWall={form.wallItemsPerWall}
          cabinetCount={form.cabinetCount}
          shelfCount={form.shelfCount}
          onVitrineCountChange={form.setVitrineCount}
          onWallCountChange={form.setWallCount}
          onWallItemsPerWallChange={form.setWallItemsPerWall}
          onCabinetCountChange={form.setCabinetCount}
          onShelfCountChange={form.setShelfCount}
          gridClassName="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          fieldWrapperClassName="space-y-2"
        />

        <div className="space-y-2">
          <Label htmlFor="notes">{t("notesLabel")}</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => form.setNotes(e.target.value)}
            placeholder={t("notesPlaceholder")}
            rows={3}
          />
        </div>
      </div>

      <LocationImageField
        name={form.name}
        locationImageId={form.locationImageId}
        locationImagePreviewUrl={form.locationImagePreviewUrl}
        isUploadingImage={form.isUploadingImage}
        fileInputRef={form.fileInputRef}
        onUpload={form.handleLocationImageUpload}
        onRemove={form.removeLocationImage}
      />
    </div>
  );
}
