import { useState, useCallback, useRef } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { resizeImage, detectAspectRatio, readFileAsDataUrl } from "../lib/image";
import type { AspectRatio, UploadedImageMeta } from "../types";

const MAX_FILE_SIZE = 15 * 1024 * 1024;

interface UseImageUploadResult {
  image: string | null;
  aspectRatio: AspectRatio;
  metadata: UploadedImageMeta | null;
  isProcessing: boolean;
  error: string | null;
  isDragActive: boolean;
  getRootProps: ReturnType<typeof useDropzone>["getRootProps"];
  getInputProps: ReturnType<typeof useDropzone>["getInputProps"];
  clear: () => void;
}

/**
 * Manage a single image upload: file → resize → base64 + aspect ratio detection.
 */
export function useImageUpload(maxSize = 1024): UseImageUploadResult {
  const [image, setImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [metadata, setMetadata] = useState<UploadedImageMeta | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const requestId = ++requestIdRef.current;
      setIsProcessing(true);
      setError(null);

      try {
        const base64 = await readFileAsDataUrl(file);
        const { data, width, height } = await resizeImage(base64, maxSize);
        if (requestId !== requestIdRef.current) return;

        setImage(data);
        setMetadata({ width, height });
        setAspectRatio(detectAspectRatio(width, height));
      } catch (uploadError) {
        if (requestId !== requestIdRef.current) return;
        console.error("Image processing error:", uploadError);
        setImage(null);
        setMetadata(null);
        setError("图片处理失败，请重新选择一张图片");
      } finally {
        if (requestId === requestIdRef.current) setIsProcessing(false);
      }
    },
    [maxSize]
  );

  const onDropRejected = useCallback((rejections: FileRejection[]) => {
    requestIdRef.current++;
    setIsProcessing(false);

    const firstError = rejections[0]?.errors[0]?.code;
    if (firstError === "file-too-large") {
      setError("图片不能超过 15MB");
    } else if (firstError === "file-invalid-type") {
      setError("仅支持 JPG、PNG 和 WebP 图片");
    } else {
      setError("图片无法上传，请重新选择");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: isProcessing,
    // react-dropzone 15's DropzoneOptions picks these React props as required
    // under React 19's type definitions, although they remain optional at runtime.
    onDragEnter: undefined,
    onDragOver: undefined,
    onDragLeave: undefined,
  });

  const clear = useCallback(() => {
    requestIdRef.current++;
    setImage(null);
    setAspectRatio("16:9");
    setMetadata(null);
    setIsProcessing(false);
    setError(null);
  }, []);

  return {
    image,
    aspectRatio,
    metadata,
    isProcessing,
    error,
    isDragActive,
    getRootProps,
    getInputProps,
    clear,
  };
}
