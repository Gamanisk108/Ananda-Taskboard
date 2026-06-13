// AI task generation — client wrapper. Compresses image uploads (reusing the
// attachment compressor) so the model + the eventual task attachment get the same
// bounded image, then multipart-POSTs to /api/ai/generate.

import { api } from "./api/client";
import { compressImageToBlob } from "./attachments";

export interface ProposedTask {
  title: string;
  priority: number;
  project_id: number | null;
  subproject_id: number | null;
  assignee_ids: number[];
  new_project: string | null;
  source_file_index: number | null;
}

export interface GenerateResult {
  tasks: ProposedTask[];
  truncated: boolean;
  remaining: number;
}

const IMAGE_RE = /\.(png|jpe?g|webp|gif)$/i;
const IMAGE_TARGET_BYTES = 1_500_000; // ~1.5 MB sent to the model

/** Generate proposed tasks from a prompt + optional files. Images are downscaled
 *  client-side first (GIFs pass through — the compressor flattens animation). */
export async function generateTasks(prompt: string, files: File[]): Promise<GenerateResult> {
  const form = new FormData();
  form.append("prompt", prompt);
  for (const f of files) {
    if (IMAGE_RE.test(f.name) && !/\.gif$/i.test(f.name)) {
      const { blob, type } = await compressImageToBlob(f, IMAGE_TARGET_BYTES);
      form.append("files", new File([blob], f.name, { type }));
    } else {
      form.append("files", f);
    }
  }
  return api.postForm("/api/ai/generate", form) as Promise<GenerateResult>;
}
