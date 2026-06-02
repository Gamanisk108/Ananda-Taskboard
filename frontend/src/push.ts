import { api } from "./api/client";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function enablePush(): Promise<string> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "This browser doesn't support push notifications.";
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "Notifications were not allowed.";

  const { vapid_public_key } = (await api.get("/api/push/config")) as { vapid_public_key: string };
  if (!vapid_public_key) return "Push isn't configured on the server yet.";

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapid_public_key) as BufferSource,
  });
  await api.post("/api/push/subscribe", sub.toJSON());
  return "Notifications enabled.";
}
