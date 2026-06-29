// Share helpers.
//
// `shareUrl` hands an arbitrary path to the native share sheet (mobile) or the
// clipboard (desktop). The share-CARD API below mints a tokenized /s/<token>
// link that unfurls into a rich preview on Slack / WhatsApp / iMessage / etc.
// (a raw in-app URL can't — it's behind auth, so the unfurl bot sees nothing).

import { api } from "./api/client";

export type ShareType = "project" | "subproject" | "task" | "subtask";

export interface ShareLink {
  token: string;
  type: ShareType;
  object_id: number;
  url: string; // absolute https://…/s/<token>
  include_description: boolean;
  deep_link: string;
  revoked: boolean;
}

/** Create (or fetch the existing durable) share link for an item. */
export function createShareLink(type: ShareType, id: number): Promise<ShareLink> {
  return api.post("/api/share", { type, id }) as Promise<ShareLink>;
}

/** Toggle whether the card/description-excerpt includes the item's description. */
export function setShareDescription(token: string, include: boolean): Promise<ShareLink> {
  return api.patch(`/api/share/${token}`, { include_description: include }) as Promise<ShareLink>;
}

/** Revoke a link (it lives forever otherwise). Safe to call once. */
export async function revokeShareLink(token: string): Promise<void> {
  await api.post(`/api/share/${token}/revoke`);
}

/** Copy text to the clipboard; resolves true on success. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Share a link via the native share sheet (mobile) or clipboard (desktop).
// `path` may be absolute or relative; it's resolved against the app origin.
export async function shareUrl(path: string, title = "Ananda Taskboard"): Promise<string> {
  const url = new URL(path, window.location.origin).toString();
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return "Shared";
    } catch {
      /* user cancelled or unsupported → fall through to copy */
    }
  }
  return (await copyText(url)) ? "Link copied!" : url;
}
