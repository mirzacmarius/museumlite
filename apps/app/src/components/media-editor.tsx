"use client";

import { AnimatePresence, m } from "framer-motion";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useReducer,
  useRef,
} from "react";
import type { Crop, PixelCrop } from "react-image-crop";
import { toast } from "sonner";
import { useActionErrorMessage } from "@/hooks/use-action-error-message";
import { useI18n } from "@/locales/client";
import { applyMediaEditsToCanvas } from "./media-editor-canvas-utils";
import { MediaEditorControls } from "./media-editor-controls";
import { MediaEditorToolbar } from "./media-editor-toolbar";
import type {
  EditMetadata,
  MediaEditorProps,
  WatermarkPosition,
} from "./media-editor-types";
import { MediaEditorViewport } from "./media-editor-viewport";

export type {
  EditMetadata,
  MediaEditorDeletion,
  MediaEditorImage,
  MediaEditorProps,
  WatermarkSettings,
} from "./media-editor-types";

interface MediaEditorState {
  crop: Crop | undefined;
  completedCrop: PixelCrop | undefined;
  rotation: number;
  brightness: number;
  contrast: number;
  isSaving: boolean;
  watermarkEnabled: boolean;
  watermarkPosition: WatermarkPosition;
}

type MediaEditorAction =
  | { type: "setCrop"; value: Crop | undefined }
  | { type: "setCompletedCrop"; value: PixelCrop | undefined }
  | { type: "setRotation"; value: number }
  | { type: "rotateLeft" }
  | { type: "rotateRight" }
  | { type: "setBrightness"; value: number }
  | { type: "setContrast"; value: number }
  | { type: "setIsSaving"; value: boolean }
  | { type: "setWatermarkEnabled"; value: boolean }
  | { type: "setWatermarkPosition"; value: WatermarkPosition }
  | {
      type: "reset";
      watermarkEnabled: boolean;
      watermarkPosition: WatermarkPosition;
    }
  | { type: "applyCrop"; pixelCrop: PixelCrop };

interface MediaEditorInitialState {
  watermarkEnabled: boolean;
  watermarkPosition: WatermarkPosition;
}

function createInitialMediaEditorState(
  defaults: MediaEditorInitialState,
): MediaEditorState {
  return {
    crop: undefined,
    completedCrop: undefined,
    rotation: 0,
    brightness: 100,
    contrast: 100,
    isSaving: false,
    watermarkEnabled: defaults.watermarkEnabled,
    watermarkPosition: defaults.watermarkPosition,
  };
}

function mediaEditorReducer(
  state: MediaEditorState,
  action: MediaEditorAction,
): MediaEditorState {
  switch (action.type) {
    case "setCrop":
      return { ...state, crop: action.value };
    case "setCompletedCrop":
      return { ...state, completedCrop: action.value };
    case "setRotation":
      return { ...state, rotation: action.value };
    case "rotateLeft":
      return { ...state, rotation: (state.rotation - 90) % 360 };
    case "rotateRight":
      return { ...state, rotation: (state.rotation + 90) % 360 };
    case "setBrightness":
      return { ...state, brightness: action.value };
    case "setContrast":
      return { ...state, contrast: action.value };
    case "setIsSaving":
      return { ...state, isSaving: action.value };
    case "setWatermarkEnabled":
      return { ...state, watermarkEnabled: action.value };
    case "setWatermarkPosition":
      return { ...state, watermarkPosition: action.value };
    case "reset":
      return createInitialMediaEditorState({
        watermarkEnabled: action.watermarkEnabled,
        watermarkPosition: action.watermarkPosition,
      });
    case "applyCrop":
      return {
        ...state,
        completedCrop: action.pixelCrop,
        crop: undefined,
      };
  }
}

export function MediaEditor({
  image,
  isOpen,
  onClose,
  onSave,
  watermarkSettings,
  deletion,
}: MediaEditorProps) {
  const translate = useI18n();
  const actionErrorMessage = useActionErrorMessage();
  const [state, dispatch] = useReducer(mediaEditorReducer, undefined, () =>
    createInitialMediaEditorState({
      watermarkEnabled: watermarkSettings?.isEnabled ?? false,
      watermarkPosition: watermarkSettings?.position ?? "bottom-right",
    }),
  );

  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen) {
      dispatch({
        type: "reset",
        watermarkEnabled: watermarkSettings?.isEnabled ?? false,
        watermarkPosition: watermarkSettings?.position ?? "bottom-right",
      });
    }
  }, [isOpen, image.id, watermarkSettings]);

  const onEscapeClose = useEffectEvent(() => {
    onClose();
  });

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onEscapeClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const applyEdits = useCallback(async () => {
    if (!imageRef.current || !canvasRef.current) return;

    await applyMediaEditsToCanvas({
      canvas: canvasRef.current,
      sourceImage: imageRef.current,
      completedCrop: state.completedCrop,
      rotation: state.rotation,
      brightness: state.brightness,
      contrast: state.contrast,
      watermarkEnabled: state.watermarkEnabled,
      watermarkSettings,
      watermarkPosition: state.watermarkPosition,
    });
  }, [
    state.completedCrop,
    state.rotation,
    state.brightness,
    state.contrast,
    state.watermarkEnabled,
    watermarkSettings,
    state.watermarkPosition,
  ]);

  const handleSave = useCallback(async () => {
    if (!canvasRef.current || !onSave) return;

    dispatch({ type: "setIsSaving", value: true });

    try {
      await applyEdits();

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvasRef.current?.toBlob(
          (b) => {
            if (b) resolve(b);
            else
              reject(
                new Error(
                  translate(
                    "untranslatedComponents.mediaEditor.failedToCreateBlob",
                  ),
                ),
              );
          },
          "image/png",
          0.95,
        );
      });

      const editMetadata: EditMetadata = {
        crop: state.completedCrop,
        rotation: state.rotation !== 0 ? state.rotation : undefined,
        brightness: state.brightness !== 100 ? state.brightness : undefined,
        contrast: state.contrast !== 100 ? state.contrast : undefined,
        watermark:
          state.watermarkEnabled && watermarkSettings?.text
            ? {
                enabled: true,
                position: state.watermarkPosition,
              }
            : undefined,
      };

      await onSave(blob, editMetadata);

      toast.success(translate("untranslatedComponents.mediaEditor.imageSaved"));
      onClose();
    } catch (error) {
      toast.error(
        actionErrorMessage(
          error,
          translate("untranslatedComponents.mediaEditor.saveFailed"),
        ),
      );
    } finally {
      dispatch({ type: "setIsSaving", value: false });
    }
  }, [
    actionErrorMessage,
    applyEdits,
    state.completedCrop,
    state.rotation,
    state.brightness,
    state.contrast,
    state.watermarkEnabled,
    watermarkSettings,
    state.watermarkPosition,
    onSave,
    onClose,
  ]);

  const handleApplyCrop = useCallback(() => {
    if (state.crop && imageRef.current) {
      const pixelCrop: PixelCrop = {
        x: (state.crop.x * imageRef.current.naturalWidth) / 100,
        y: (state.crop.y * imageRef.current.naturalHeight) / 100,
        width: (state.crop.width! * imageRef.current.naturalWidth) / 100,
        height: (state.crop.height! * imageRef.current.naturalHeight) / 100,
        unit: "px",
      };
      dispatch({ type: "applyCrop", pixelCrop });
    }
  }, [state.crop]);

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-background backdrop-blur-sm"
          onClick={onClose}
        >
          <MediaEditorToolbar
            image={image}
            hasCrop={Boolean(state.crop)}
            isSaving={state.isSaving}
            onRotateLeft={() => dispatch({ type: "rotateLeft" })}
            onRotateRight={() => dispatch({ type: "rotateRight" })}
            onApplyCrop={handleApplyCrop}
            onSave={handleSave}
            onClose={onClose}
            deletion={deletion}
          />

          <MediaEditorViewport
            imageUrl={image.url}
            imageTitle={image.title}
            crop={state.crop}
            rotation={state.rotation}
            brightness={state.brightness}
            contrast={state.contrast}
            watermarkEnabled={state.watermarkEnabled}
            watermarkSettings={watermarkSettings}
            watermarkPosition={state.watermarkPosition}
            imageRef={imageRef}
            onCropChange={(value) => dispatch({ type: "setCrop", value })}
          />

          <MediaEditorControls
            brightness={state.brightness}
            contrast={state.contrast}
            watermarkEnabled={state.watermarkEnabled}
            watermarkText={watermarkSettings?.text}
            watermarkPosition={state.watermarkPosition}
            onBrightnessChange={(value) =>
              dispatch({ type: "setBrightness", value })
            }
            onContrastChange={(value) =>
              dispatch({ type: "setContrast", value })
            }
            onWatermarkEnabledChange={(value) =>
              dispatch({ type: "setWatermarkEnabled", value })
            }
            onWatermarkPositionChange={(value) =>
              dispatch({ type: "setWatermarkPosition", value })
            }
          />

          <canvas ref={canvasRef} className="hidden" />
        </m.div>
      )}
    </AnimatePresence>
  );
}
