// AI task generation — client wrapper. Compresses image uploads (reusing the
// attachment compressor) so the model + the eventual task attachment get the same
// bounded image, then multipart-POSTs to /api/ai/generate.

import { api } from "./api/client";
import { compressImageToBlob } from "./attachments";
import type { Recurrence } from "./types";

export interface ProposedTask {
  title: string;
  priority: number;
  project_id: number | null;
  subproject_id: number | null;
  /** When set, this proposal's subtasks are ADDED to that existing task — no new
   *  task is created. project_id/subproject_id/recurrence/etc. are then null. */
  existing_task_id: number | null;
  assignee_ids: number[];
  new_project: string | null;
  source_file_index: number | null;
  subtasks: string[];
  recurrence: Recurrence | null;
  start_date: string | null;
  deadline: string | null;
}

export interface ExistingTaskOption {
  id: number;
  title: string;
  project: string;
  subproject: string;
}

export interface GenerateResult {
  tasks: ProposedTask[];
  truncated: boolean;
  remaining: number;
  /** Existing tasks the model could route to — the review UI's "File under" list. */
  existing_tasks: ExistingTaskOption[];
}

const IMAGE_RE = /\.(png|jpe?g|webp|gif)$/i;
const IMAGE_TARGET_BYTES = 1_500_000; // ~1.5 MB sent to the model

/** Generate proposed tasks from a prompt + optional files. Images are downscaled
 *  client-side first (GIFs pass through — the compressor flattens animation).
 *  Pass targetTaskId to force a focused breakdown: every proposal attaches as
 *  subtasks to that one existing task. */
export async function generateTasks(prompt: string, files: File[], targetTaskId?: number): Promise<GenerateResult> {
  const form = new FormData();
  form.append("prompt", prompt);
  if (targetTaskId != null) form.append("target_task_id", String(targetTaskId));
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
