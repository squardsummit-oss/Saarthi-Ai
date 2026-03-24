/**
 * Send push notification to a user via FCM.
 * Also creates a notification document in Firestore for in-app display.
 */
export declare function sendComplaintNotification(userId: string, complaintId: string, title: string, body: string): Promise<void>;
