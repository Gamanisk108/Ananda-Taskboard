import { useRef, useState } from "react";

/** Guard an async submit against double/triple-click: the synchronous ref blocks
 *  re-entry immediately (React state lags a tick), while `busy` drives `disabled`.
 *  Returns [busy, run]; wrap the handler body in `run(async () => {…})`. */
export function useSubmitGuard(): readonly [boolean, (fn: () => Promise<void>) => Promise<void>] {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return [busy, run] as const;
}
