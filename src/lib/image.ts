import type { AspectRatio, UploadedImageMeta } from "../types";

export function formatImageAspectRatio(metadata: UploadedImageMeta): string {
  const width = Math.max(1, Math.round(metadata.width));
  const height = Math.max(1, Math.round(metadata.height));
  return `${width} / ${height}`;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("无法读取图片文件"));
    reader.readAsDataURL(file);
  });
}

/**
 * Resize an image (base64 data URL) so the longest side <= maxSize.
 * Returns the resized data URL plus pixel dimensions.
 */
export function resizeImage(
  base64Str: string,
  maxSize: number
): Promise<{ data: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height = (maxSize / width) * height;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (maxSize / height) * width;
          height = maxSize;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("当前浏览器不支持图片压缩"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", 0.85);
      if (!data.startsWith("data:image/jpeg;base64,")) {
        reject(new Error("图片压缩失败"));
        return;
      }
      resolve({
        data,
        width: canvas.width,
        height: canvas.height,
      });
    };
    img.onerror = reject;
  });
}

/**
 * Detect the closest supported aspect ratio from pixel dimensions.
 */
export function detectAspectRatio(width: number, height: number): AspectRatio {
  const ratio = width / height;
  if (ratio >= 1.5) return "16:9";
  if (ratio >= 1.1) return "4:3";
  if (ratio >= 0.85) return "1:1";
  if (ratio >= 0.65) return "3:4";
  return "9:16";
}

/**
 * Extract the raw base64 (without data URL prefix) and mime type.
 */
export function parseDataUrl(dataUrl: string): { data: string; mimeType: string } {
  const match = dataUrl.match(/^data:(.+?);base64,(.*)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return { mimeType: "image/jpeg", data: dataUrl };
}
