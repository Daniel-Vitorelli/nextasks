const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

/** Push não suportado (browser antigo ou contexto inseguro). */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext === true &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (registration) return registration;
  return navigator.serviceWorker.register("/sw.js");
}

type PermissionState = "granted" | "denied" | "default";

/** Estado atual para a UI de configuração. */
export async function getPushState(): Promise<
  "unsupported" | "insecure" | "denied" | "subscribed" | "unsubscribed"
> {
  if (!isPushSupported()) {
    // Contexto seguro é requisito de service worker/push: HTTP fora de
    // localhost não permite nem registrar o SW — motivo merece msg própria.
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      return "insecure";
    }
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  const registration = await getRegistration();
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? "subscribed" : "unsubscribed";
}

/**
 * Fluxo completo de ativação: permissão → subscribe → registro no servidor.
 * Retorna o estado final para feedback na UI.
 */
export async function enablePush(locale: string): Promise<
  "subscribed" | "denied" | "error"
> {
  if (!isPushSupported() || !PUBLIC_KEY) return "error";

  const permission: PermissionState =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  try {
    const registration = await getRegistration();
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
      }));

    const json = subscription.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        locale,
      }),
    });
    if (!response.ok) return "error";
    return "subscribed";
  } catch {
    return "error";
  }
}

/** Desativa: unsubscribe no navegador + remoção no servidor. */
export async function disablePush(): Promise<boolean> {
  try {
    const registration = await getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;

    const endpoint = subscription.endpoint;
    const unsubscribed = await subscription.unsubscribe();
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    }).catch(() => undefined);
    return unsubscribed;
  } catch {
    return false;
  }
}
