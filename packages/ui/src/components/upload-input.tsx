"use client";

import {
  type UploadFileResponse,
  useUploadFiles,
} from "@xixixao/uploadstuff/react";
import { type InputHTMLAttributes, useRef } from "react";

export function UploadInput({
  generateUploadUrl,
  onUploadComplete,
  onUploadError,
  ...props
}: {
  generateUploadUrl: (mimeType: string) => Promise<string>;
  onUploadComplete: (uploaded: UploadFileResponse[]) => void | Promise<void>;
  /** Called when the upload URL, the upload or `onUploadComplete` fails. */
  onUploadError?: (error: unknown) => void;
} & Pick<
  InputHTMLAttributes<HTMLInputElement>,
  "accept" | "id" | "type" | "className" | "required" | "tabIndex"
>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<File[]>([]);

  const { startUpload } = useUploadFiles(
    async () => {
      const file = filesRef.current.shift();

      if (!file) {
        throw new Error("No file available for upload");
      }

      const uploadUrl = await generateUploadUrl(file.type);

      return uploadUrl;
    },
    {
      onUploadComplete: async (uploaded) => {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        await onUploadComplete(uploaded);
      },
      onUploadError: (error) => {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        onUploadError?.(error);
      },
    },
  );

  return (
    <input
      ref={fileInputRef}
      type="file"
      onChange={async (event) => {
        if (!event.target.files) {
          return;
        }
        const files = Array.from(event.target.files);
        if (files.length === 0) {
          return;
        }
        filesRef.current = files;
        startUpload(files);
      }}
      {...props}
    />
  );
}
