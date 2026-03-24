export declare const db: FirebaseFirestore.Firestore;
export declare const storage: import("firebase-admin/storage").Storage;
export declare const auth: import("firebase-admin/auth").Auth;
export declare const messaging: import("firebase-admin/messaging").Messaging;
export declare const REGION = "asia-south1";
export declare const COMPLAINT_STATUS: {
    readonly PENDING: "pending";
    readonly IN_PROGRESS: "in-progress";
    readonly RESOLVED: "resolved";
    readonly REJECTED: "rejected";
};
export declare const PRIORITY: {
    readonly LOW: "low";
    readonly MEDIUM: "medium";
    readonly HIGH: "high";
    readonly CRITICAL: "critical";
};
export declare const USER_ROLES: {
    readonly CITIZEN: "citizen";
    readonly OFFICER: "officer";
    readonly ADMIN: "admin";
};
export declare const COLLECTIONS: {
    readonly USERS: "users";
    readonly COMPLAINTS: "complaints";
    readonly DEPARTMENTS: "departments";
    readonly NOTIFICATIONS: "notifications";
    readonly ACTIVITY_LOGS: "activityLogs";
};
export declare const SUPPORTED_LANGUAGES: readonly ["en", "te", "hi", "ta", "ml", "kn"];
export declare const MAX_AUDIO_SIZE_MB = 25;
export declare const MAX_IMAGE_SIZE_MB = 10;
export declare const DUPLICATE_WINDOW_HOURS = 24;
