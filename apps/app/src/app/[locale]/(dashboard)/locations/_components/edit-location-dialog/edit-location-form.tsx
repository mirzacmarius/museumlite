"use client";

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
import { useScopedI18n } from "@/locales/client";
import { LocationImageField } from "../location-form-shared/location-image-field";
import { LocationTypeSelect } from "../location-form-shared/location-type-select";
import { LocationUnitCountFields } from "../location-form-shared/location-unit-count-fields";
import type { useEditLocationForm } from "./use-edit-location-form";

type EditLocationFormState = ReturnType<typeof useEditLocationForm>;

interface EditLocationFormProps {
  form: EditLocationFormState;
  readOnly?: boolean;
}

export function EditLocationForm({
  form,
  readOnly = false,
}: EditLocationFormProps) {
  const t = useScopedI18n("locations.form");
  const tLocations = useScopedI18n("locations");
  const tMove = useScopedI18n("locations.move");

  return (
    <div className="grid gap-4 py-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] lg:items-start">
      {form.error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive lg:col-span-2">
          {form.error}
        </div>
      )}

      <div className="grid gap-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="name">{t("nameLabel")}</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => form.setName(e.target.value)}
              placeholder={t("nameEnterPlaceholder")}
              required={!readOnly}
              readOnly={readOnly}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="locationCode">{t("locationIdLabel")}</Label>
            <Input
              id="locationCode"
              value={form.locationCode}
              onChange={(e) => form.setLocationCode(e.target.value)}
              placeholder={t("locationIdPlaceholder")}
              required={!readOnly}
              readOnly={readOnly}
              maxLength={50}
            />
          </div>

          <LocationTypeSelect
            value={form.type}
            onChange={form.setType}
            readOnly={readOnly}
          />

          <div className="grid gap-2">
            <Label htmlFor="parent-location">
              {tLocations("parentLocation")}
            </Label>
            <Select
              value={form.parentLocationId}
              onValueChange={form.setParentLocationId}
              disabled={readOnly}
            >
              <SelectTrigger
                id="parent-location"
                className="disabled:opacity-100"
              >
                <SelectValue
                  placeholder={tMove("selectDestinationPlaceholder")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">
                  <span className="font-medium">{tMove("rootOption")}</span>
                </SelectItem>
                {form.availableParentLocations.map((parentLocation) => (
                  <SelectItem key={parentLocation.id} value={parentLocation.id}>
                    <span
                      style={{
                        paddingLeft: `${parentLocation.level * 12}px`,
                      }}
                    >
                      {parentLocation.name} ({parentLocation.type})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address">{t("addressLabel")}</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => form.setAddress(e.target.value)}
              placeholder={t("addressEnterPlaceholder")}
              readOnly={readOnly}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="capacity">{t("capacityLabel")}</Label>
            <Input
              id="capacity"
              type="number"
              min="0"
              value={form.capacity}
              onChange={(e) => form.setCapacity(e.target.value)}
              placeholder={t("capacityPlaceholder")}
              readOnly={readOnly}
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
          readOnly={readOnly}
        />

        <div className="grid gap-2">
          <Label htmlFor="notes">{t("notesLabel")}</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => form.setNotes(e.target.value)}
            placeholder={t("notesEnterPlaceholder")}
            rows={3}
            readOnly={readOnly}
          />
        </div>
      </div>

      <div className="grid gap-4">
        <LocationImageField
          name={form.name}
          locationImageId={form.locationImageId}
          locationImagePreviewUrl={form.locationImagePreviewUrl}
          existingImageUrl={form.existingImageUrl}
          isUploadingImage={form.isUploadingImage}
          fileInputRef={form.fileInputRef}
          onUpload={form.handleLocationImageUpload}
          onRemove={form.removeLocationImage}
          readOnly={readOnly}
        />

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="temperature">{t("temperatureLabel")}</Label>
            <Input
              id="temperature"
              type="number"
              step="0.1"
              value={form.temperature}
              onChange={(e) => form.setTemperature(e.target.value)}
              placeholder={t("temperaturePlaceholder")}
              readOnly={readOnly}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="humidity">{t("humidityLabel")}</Label>
            <Input
              id="humidity"
              type="number"
              min="0"
              max="100"
              value={form.humidity}
              onChange={(e) => form.setHumidity(e.target.value)}
              placeholder={t("humidityPlaceholder")}
              readOnly={readOnly}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
