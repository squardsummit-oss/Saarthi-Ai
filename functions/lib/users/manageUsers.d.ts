/**
 * Auth Blocking Function — runs before user creation completes.
 * Creates user profile in Firestore with default "citizen" role.
 */
export declare const onUserCreate: import("firebase-functions/v1").BlockingFunction;
/**
 * Admin-only: List all users with optional role filter.
 */
export declare const listUsers: import("firebase-functions/https").CallableFunction<any, Promise<{
    users: {
        userId: string;
        name: any;
        email: any;
        phone: any;
        role: any;
        departmentId: any;
        createdAt: any;
    }[];
    count: number;
}>, unknown>;
/**
 * Admin-only: Update a user's role and/or department assignment.
 */
export declare const updateUserRole: import("firebase-functions/https").CallableFunction<any, Promise<{
    success: boolean;
    userId: string;
    updates: Record<string, unknown>;
}>, unknown>;
/**
 * Any user: Register FCM token for push notifications.
 */
export declare const registerFcmToken: import("firebase-functions/https").CallableFunction<any, Promise<{
    success: boolean;
}>, unknown>;
