import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "@mpipe/shared/db";
import { pushSubscriptions } from "@mpipe/shared/db/schema";
import { env } from "../env.js";

if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(env.VAPID_EMAIL, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
}

export async function notifyDocUpdated(docId: string, title: string, version: number) {
  const subs = await db.select().from(pushSubscriptions);

  const payload = JSON.stringify({
    title: "Document Updated",
    body: `${title} was updated (v${version})`,
    url: `/d/${docId}`,
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, payload);
    } catch {
      // Remove stale subscriptions
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
    }
  }
}
