// Media attachments — client-side compression + the R2 presigned-upload dance.
// Images are downscaled/re-encoded to fit the cap; docs/video upload as-is
// (size-capped). The bytes go straight to R2 via a presigned PUT; only a small
// register call hits our API.
import { api } from "./api/client";

export type AttachTarget = "task" | "subtask" | "report";
export interface Attachment {
  id: number;
  filename: string;
  content_type: string;
  kind: "image" | "doc" | "video";
  size: number;
  uploaded_by_name: string | null;
  url: string;
  created_at: string;
}

export const ATTACH_CAPS = { image: 2 * 1024 * 1024, doc: 5 * 1024 * 1024, video: 25 * 1024 * 1024 };
export const ATTACH_MAX = 5;
const DOC_TYPES = new Set([
  "application/pdf", "text/plain", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
/** accept attribute for the file picker. */
export const ATTACH_ACCEPT = "image/*,video/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx";

export function kindOf(type: string): "image" | "doc" | "video" | null {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (DOC_TYPES.has(type)) return "doc";
  return null;
}

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Type/size gate for a freshly picked file (images are size-checked after
 *  compression, in uploadAttachment, so only docs/video are capped here). */
export function precheck(file: File): void {
  const kind = kindOf(file.type);
  if (!kind) throw new Error(`“${file.name}” isn't a supported file type.`);
  if (kind !== "image" && file.size > ATTACH_CAPS[kind]) {
    const mb = Math.round(ATTACH_CAPS[kind] / (1024 * 1024));
    throw new Error(`“${file.name}” is too large (max ${mb} MB for ${kind}).`);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = url;
  });
}
function toBlob(canvas: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, q));
}

/** Downscale + JPEG-compress an image to fit `maxBytes` (animated GIFs pass
 *  through untouched — canvas would flatten them). */
export async function compressImageToBlob(file: File, maxBytes: number): Promise<{ blob: Blob; type: string }> {
  if (file.type === "image/gif") return { blob: file, type: file.type };
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.85, 0.7, 0.55, 0.4]) {
      const blob = await toBlob(canvas, "image/jpeg", q);
      if (blob && blob.size <= maxBytes) return { blob, type: "image/jpeg" };
    }
    const blob = await toBlob(canvas, "image/jpeg", 0.3);
    return { blob: blob ?? file, type: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Upload one file to a target, returning the created Attachment.
 *  Throws an Error (message is user-facing) on unsupported type / too-large /
 *  upload failure / uploads-not-configured. */
export async function uploadAttachment(target: AttachTarget, targetId: number, file: File): Promise<Attachment> {
  const kind = kindOf(file.type);
  if (!kind) throw new Error(`“${file.name}” isn't a supported file type.`);
  let blob: Blob = file;
  let type = file.type;
  if (kind === "image") {
    const c = await compressImageToBlob(file, ATTACH_CAPS.image);
    blob = c.blob;
    type = c.type;
  }
  if (blob.size > ATTACH_CAPS[kind]) {
    const mb = Math.round(ATTACH_CAPS[kind] / (1024 * 1024));
    throw new Error(`“${file.name}” is too large (max ${mb} MB for ${kind}).`);
  }
  const presign = (await api.post("/api/attachments/presign", {
    [target]: targetId, filename: file.name, content_type: type, size: blob.size,
  })) as { key: string; put_url: string };
  const put = await fetch(presign.put_url, { method: "PUT", body: blob, headers: { "Content-Type": type } });
  if (!put.ok) throw new Error(`Upload of “${file.name}” failed.`);
  return (await api.post("/api/attachments", {
    [target]: targetId, key: presign.key, filename: file.name, content_type: type,
  })) as Attachment;
}
