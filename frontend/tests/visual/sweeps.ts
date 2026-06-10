import type { Page } from "@playwright/test";

/**
 * At-a-glance geometry sweeps (QA playbook §2a, born from the off-center
 * Sign-in button that survived five snapshot-driven QA passes).
 *
 * These are objective, page-wide detectors for the defect classes a human
 * notices instantly but an accessibility snapshot can never see:
 *  - a button label packed left inside a stretched button
 *  - hard-clipped text with no ellipsis (D42)
 *  - side-by-side connected controls that aren't flush top+bottom (D39)
 */

export interface SweepFlag {
  kind: string;
  label: string;
  detail: string;
}

/** Buttons that are intentionally left-packed rows (menus, nav, accordion
 *  heads, select triggers, poll bars) — never flag these. */
const LEFT_PACKED_ALLOW = [
  ".ms-btn", ".usermenu-item", ".set-nav .sn", ".trc-sec-head", ".poll-bar",
  ".poll-exp", ".an-attach", ".help-q", ".help-cat", ".dnav button",
  ".tr-simbtn", ".sl-row", ".crow",
].join(",");

export async function sweepOffCenterButtons(page: Page): Promise<SweepFlag[]> {
  return page.evaluate((allow) => {
    const out: { kind: string; label: string; detail: string }[] = [];
    for (const btn of Array.from(document.querySelectorAll<HTMLButtonElement>("button"))) {
      if (btn.matches(allow) || btn.closest(allow)) continue;
      const b = btn.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      const cs = getComputedStyle(btn);
      const range = document.createRange();
      range.selectNodeContents(btn);
      const t = range.getBoundingClientRect();
      if (t.width === 0) continue;
      const slack = b.width - t.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const offCenter = Math.abs((t.left + t.width / 2) - (b.left + b.width / 2));
      if (slack > 14 && offCenter > 4) {
        out.push({
          kind: "off-center-button",
          label: (btn.textContent || "").trim().slice(0, 40),
          detail: `offset ${Math.round(offCenter)}px, slack ${Math.round(slack)}px, class "${btn.className}"`,
        });
      }
    }
    return out;
  }, LEFT_PACKED_ALLOW);
}

/** Track/progress elements legitimately overflow-hidden with no text. */
const CLIP_ALLOW = [".pb-track", ".ptrack", ".segbar-track", ".an-tg"].join(",");

/** D42: text never hard-clips — overflow:hidden truncation must carry an
 *  ellipsis (with a reachable full value) or wrap. */
export async function sweepHardClippedText(page: Page): Promise<SweepFlag[]> {
  return page.evaluate((allow) => {
    const out: { kind: string; label: string; detail: string }[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      if (out.length >= 20) break; // enough to fail loudly without spam
      if (el.matches(allow) || el.closest(allow)) continue;
      const hasOwnText = Array.from(el.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent || "").trim().length > 3,
      );
      if (!hasOwnText) continue;
      const cs = getComputedStyle(el);
      if (cs.overflowX !== "hidden" && cs.overflowX !== "clip") continue;
      if (cs.textOverflow === "ellipsis") continue; // sanctioned pattern
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        out.push({
          kind: "hard-clipped-text",
          label: (el.textContent || "").trim().slice(0, 40),
          detail: `scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}, <${el.tagName.toLowerCase()} class="${el.className}">`,
        });
      }
    }
    return out;
  }, CLIP_ALLOW);
}

/** D39: side-by-side connected controls (a field + its action button sharing a
 *  row) must be flush on BOTH top and bottom edges. */
export async function sweepFlushRows(page: Page, rowSelectors: string[]): Promise<SweepFlag[]> {
  return page.evaluate((selectors) => {
    const out: { kind: string; label: string; detail: string }[] = [];
    for (const sel of selectors) {
      for (const row of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
        const controls = Array.from(
          row.querySelectorAll<HTMLElement>(":scope > input, :scope > textarea, :scope > button, :scope > .tr-savedwrap"),
        ).filter((c) => c.getBoundingClientRect().height > 0);
        if (controls.length < 2) continue;
        const rects = controls.map((c) => c.getBoundingClientRect());
        const topSpread = Math.max(...rects.map((r) => r.top)) - Math.min(...rects.map((r) => r.top));
        const bottomSpread = Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.bottom));
        if (topSpread > 1.5 || bottomSpread > 1.5) {
          out.push({
            kind: "d39-not-flush",
            label: sel,
            detail: `top spread ${topSpread.toFixed(1)}px, bottom spread ${bottomSpread.toFixed(1)}px`,
          });
        }
      }
    }
    return out;
  }, rowSelectors);
}

/** Run every sweep; returns a flat list of flags (empty = clean page). */
export async function sweepPage(page: Page): Promise<SweepFlag[]> {
  return [
    ...(await sweepOffCenterButtons(page)),
    ...(await sweepHardClippedText(page)),
    ...(await sweepFlushRows(page, [".tr-inputrow", ".an-copyrow"])),
  ];
}
