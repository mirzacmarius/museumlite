import type { PixelCrop } from "react-image-crop";
import type { WatermarkSettings } from "./media-editor-types";

export async function applyMediaEditsToCanvas({
  canvas,
  sourceImage,
  completedCrop,
  rotation,
  brightness,
  contrast,
  watermarkEnabled,
  watermarkSettings,
  watermarkPosition,
}: {
  canvas: HTMLCanvasElement;
  sourceImage: HTMLImageElement;
  completedCrop?: PixelCrop;
  rotation: number;
  brightness: number;
  contrast: number;
  watermarkEnabled: boolean;
  watermarkSettings?: WatermarkSettings;
  watermarkPosition:
    | "center"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";
}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const cropWidth = completedCrop?.width || sourceImage.naturalWidth;
  const cropHeight = completedCrop?.height || sourceImage.naturalHeight;

  if (rotation % 180 === 90 || rotation % 180 === -90) {
    canvas.width = cropHeight;
    canvas.height = cropWidth;
  } else {
    canvas.width = cropWidth;
    canvas.height = cropHeight;
  }

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);
  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

  if (completedCrop) {
    ctx.drawImage(
      sourceImage,
      completedCrop.x,
      completedCrop.y,
      completedCrop.width,
      completedCrop.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  } else {
    ctx.drawImage(
      sourceImage,
      0,
      0,
      sourceImage.naturalWidth,
      sourceImage.naturalHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }

  ctx.restore();

  if (watermarkEnabled && watermarkSettings?.text) {
    const watermarkText = watermarkSettings.text;
    const opacity = watermarkSettings.opacity ?? 0.5;
    const fontSize = Math.max(16, canvas.width * 0.025);
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.strokeStyle = `rgba(0, 0, 0, ${opacity * 0.5})`;
    ctx.lineWidth = 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const padding = 20;
    let x = canvas.width / 2;
    let y = canvas.height / 2;

    switch (watermarkPosition) {
      case "center":
        x = canvas.width / 2;
        y = canvas.height / 2;
        break;
      case "top-left":
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        x = padding;
        y = padding;
        break;
      case "top-right":
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        x = canvas.width - padding;
        y = padding;
        break;
      case "bottom-left":
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        x = padding;
        y = canvas.height - padding;
        break;
      case "bottom-right":
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        x = canvas.width - padding;
        y = canvas.height - padding;
        break;
    }

    ctx.strokeText(watermarkText, x, y);
    ctx.fillText(watermarkText, x, y);
  }
}
