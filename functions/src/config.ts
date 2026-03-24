import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";

// Initialize Firebase Admin SDK (auto-detects project in Cloud Functions)
const app = initializeApp();

// Service references
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const messaging = getMessaging(app);

// Constants
export const REGION = "asia-south1"; // Mumbai — closest to Indian users

export const COMPLAINT_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in-progress",
  RESOLVED: "resolved",
  REJECTED: "rejected",
} as const;

export const PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

export const USER_ROLES = {
  CITIZEN: "citizen",
  OFFICER: "officer",
  ADMIN: "admin",
} as const;

export const COLLECTIONS = {
  USERS: "users",
  COMPLAINTS: "complaints",
  DEPARTMENTS: "departments",
  NOTIFICATIONS: "notifications",
  ACTIVITY_LOGS: "activityLogs",
} as const;

export const SUPPORTED_LANGUAGES = ["en", "te", "hi", "ta", "ml", "kn"] as const;

export const MAX_AUDIO_SIZE_MB = 25;
export const MAX_IMAGE_SIZE_MB = 10;
export const DUPLICATE_WINDOW_HOURS = 24;
