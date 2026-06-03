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
  try {
    await navigator.clipboard.writeText(url);
    return "Link copied!";
  } catch {
    return url;
  }
}
