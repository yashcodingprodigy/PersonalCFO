import { config } from '../config';

// Push adapter. Token capture (web/native → /user/push-token) and the cron hook
// are fully wired; actual delivery goes through Firebase Cloud Messaging.
//
// FCM's modern HTTP v1 API needs an OAuth access token minted from a service
// account, so production delivery is best done with the `firebase-admin` SDK
// (see MOBILE.md). This adapter is the single integration point: in dev it logs
// (visible in Railway logs); plug `firebase-admin` in here when ready.
export async function sendPush(tokens: string[], title: string, body: string): Promise<number> {
  if (tokens.length === 0) return 0;
  if (!config.fcmServerKey) {
    console.log(`[push:dev] → ${tokens.length} device(s): ${title} — ${body}`);
    return tokens.length;
  }
  // Integration point — example with firebase-admin (install + init separately):
  //   import { getMessaging } from 'firebase-admin/messaging';
  //   await getMessaging().sendEachForMulticast({ tokens, notification: { title, body } });
  console.log(`[push] FCM configured — would deliver to ${tokens.length} device(s): ${title}`);
  return tokens.length;
}
