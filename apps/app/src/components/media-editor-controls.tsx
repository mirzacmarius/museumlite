"use client";

import type { WatermarkPosition } from "./media-editor-types";

interface MediaEditorControlsProps {
  brightness: number;
  contrast: number;
  watermarkEnabled: boolean;
  watermarkText?: string;
  watermarkPosition: WatermarkPosition;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
  onWatermarkEnabledChange: (enabled: boolean) => void;
  onWatermarkPositionChange: (position: WatermarkPosition) => void;
}

export function MediaEditorControls({
  brightness,
  contrast,
  watermarkEnabled,
  watermarkText,
  watermarkPosition,
  onBrightnessChange,
  onContrastChange,
  onWatermarkEnabledChange,
  onWatermarkPositionChange,
}: MediaEditorControlsProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 bg-card/40 border-t border-border/60 backdrop-blur-xl p-4">
      <div className="grid grid-cols-2 gap-4 max-w-4xl mx-auto">
        <div className="flex flex-col gap-2">
          <label htmlFor="brightness" className="text-xs text-muted-foreground">
            Brightness: {brightness}%
          </label>
          <input
            id="brightness"
            type="range"
            min="0"
            max="200"
            value={brightness}
            onChange={(e) => onBrightnessChange(Number(e.target.value))}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="contrast" className="text-xs text-muted-foreground">
            Contrast: {contrast}%
          </label>
          <input
            id="contrast"
            type="range"
            min="0"
            max="200"
            value={contrast}
            onChange={(e) => onContrastChange(Number(e.target.value))}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full"
          />
        </div>
        {watermarkText && (
          <>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="watermark-toggle"
                className="text-xs text-muted-foreground"
              >
                Watermark
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="watermark-toggle"
                  type="checkbox"
                  checked={watermarkEnabled}
                  onChange={(e) => onWatermarkEnabledChange(e.target.checked)}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="size-4 rounded border-border"
                />
                <span className="text-xs text-foreground">{watermarkText}</span>
              </div>
            </div>
            {watermarkEnabled && (
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="watermark-position"
                  className="text-xs text-muted-foreground"
                >
                  Position
                </label>
                <select
                  id="watermark-position"
                  value={watermarkPosition}
                  onChange={(e) =>
                    onWatermarkPositionChange(
                      e.target.value as WatermarkPosition,
                    )
                  }
                  onMouseDown={(e) => e.stopPropagation()}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                >
                  <option value="center">Center</option>
                  <option value="top-left">Top Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-right">Bottom Right</option>
                </select>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
