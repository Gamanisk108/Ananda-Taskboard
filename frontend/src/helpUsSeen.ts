// The Help Us "what's-new" dot (design D36): purple until the member opens the
// Help Us pane once, tracked per-browser like the help-center dot.

const KEY = "at-helpus-seen";

export function helpUsUnseen(): boolean {
  return !localStorage.getItem(KEY);
}

export function markHelpUsSeen() {
  localStorage.setItem(KEY, "1");
}
