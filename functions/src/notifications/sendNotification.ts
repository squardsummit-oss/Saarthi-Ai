import * as logger from "firebase-functions/logger";
import { db, messaging, COLLECTIONS } from "../config.js";

/**
 * Send push notification to a user via FCM.
 * Also creates a notification document in Firestore for in-app display.
 */
export async function sendComplaintNotification(
  userId: string,
  complaintId: string,
  title: string,
  body: string
): Promise<void> {
  try {
    // Get user's FCM tokens
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();

    if (!userDoc.exists) {
      logger.warn("User not found for notification", { userId });
      return;
    }

    const tokens: string[] = userDoc.data()?.fcmTokens || [];

    if (tokens.length === 0) {
      logger.info("No FCM tokens for user, skipping push", { userId });
      return;
    }

    // Send to all user's devices
    const invalidTokens: string[] = [];

    for (const token of tokens) {
      try {
        await messaging.send({
          token,
          notification: {
            title,
            body,
          },
          data: {
            complaintId,
            type: "complaint_update",
            click_action: "OPEN_COMPLAINT",
          },
          android: {
            priority: "high",
            notification: {
              channelId: "complaint_updates",
              sound: "default",
            },
          },
          webpush: {
            notification: {
              icon: "/icons/icon-192x192.png",
              badge: "/icons/badge-72x72.png",
            },
            fcmOptions: {
              link: `/track?id=${complaintId}`,
            },
          },
        });
      } catch (err: unknown) {
        const error = err as { code?: string };
        if (
          error.code === "messaging/invalid-registration-token" ||
          error.code === "messaging/registration-token-not-registered"
        ) {
          invalidTokens.push(token);
        } else {
          logger.error("FCM send error", { token, error: String(err) });
        }
      }
    }

    // Clean up invalid tokens
    if (invalidTokens.length > 0) {
      const validTokens = tokens.filter((t) => !invalidTokens.includes(t));
      await db.collection(COLLECTIONS.USERS).doc(userId).update({
        fcmTokens: validTokens,
      });
      logger.info("Removed invalid FCM tokens", {
        userId,
        removed: invalidTokens.length,
      });
    }

    logger.info("Notification sent", { userId, title });
  } catch (error) {
    logger.error("Notification failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
