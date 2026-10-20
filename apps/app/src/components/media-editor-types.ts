export interface MediaEditorImage {
  id: string;
  url: string;
  title?: string;
}

export interface WatermarkSettings {
  isEnabled?: boolean;
  text?: string;
  opacity?: number;
  position?:
    | "center"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";
}

export interface MediaEditorProps {
  image: MediaEditorImage;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (editedBlob: Blob, editMetadata: EditMetadata) => Promise<void>;
  watermarkSettings?: WatermarkSettings;
  deletion?: MediaEditorDeletion;
}

/** Offers deleting the image from the editor's toolbar. */
export interface MediaEditorDeletion {
  /** The image already waits for deletion approval. */
  pending: boolean;
  /** Marked for deletion in the form, to be sent with Update Object. */
  marked: boolean;
  onDelete: () => void;
  /** Takes back the mark, keeping the image. */
  onKeep: () => void;
}

export interface EditMetadata {
  crop?: import("react-image-crop").PixelCrop;
  rotation?: number;
  brightness?: number;
  contrast?: number;
  watermark?: {
    enabled: boolean;
    position?: string;
  };
}

export type WatermarkPosition =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";
