import { Timestamp, GeoPoint } from "firebase-admin/firestore";

// ─── User ────────────────────────────────────────────────────
export interface UserProfile {
  userId: string;
  name: string;
  phone: string;
  email: string | null;
  role: "citizen" | "officer" | "admin";
  departmentId: string | null;
  fcmTokens: string[];
  language: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Complaint ───────────────────────────────────────────────
export interface Complaint {
  complaintId: string;
  userId: string;
  audioUrl: string | null;
  transcript: string;
  translatedText: string;
  originalLanguage: string;
  category: string;
  department: string;
  status: "pending" | "in-progress" | "resolved" | "rejected";
  priority: "low" | "medium" | "high" | "critical";
  location: GeoPoint | null;
  areaName: string;
  imageUrls: string[];
  assignedOfficerId: string | null;
  resolutionNote: string | null;
  duplicateOf: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateComplaintInput {
  transcript: string;
  translatedText?: string;
  originalLanguage?: string;
  category?: string;
  location?: { lat: number; lng: number };
  areaName?: string;
  audioUrl?: string;
  imageUrls?: string[];
  priority?: string;
}

export interface UpdateStatusInput {
  complaintId: string;
  status: string;
  resolutionNote?: string;
  assignedOfficerId?: string;
}

// ─── Department ──────────────────────────────────────────────
export interface Department {
  departmentId: string;
  name: string;
  categoriesHandled: string[];
  officerIds: string[];
  contactEmail: string;
  isActive: boolean;
}

export interface CreateDepartmentInput {
  name: string;
  categoriesHandled: string[];
  contactEmail?: string;
}

// ─── Activity Log ────────────────────────────────────────────
export interface ActivityLog {
  logId: string;
  action: "created" | "status_changed" | "assigned" | "note_added" | "ai_processed";
  actorId: string;
  actorRole: "citizen" | "officer" | "admin" | "system";
  previousValue: string | null;
  newValue: string;
  note: string | null;
  timestamp: Timestamp;
}

// ─── Notification ────────────────────────────────────────────
export interface AppNotification {
  notificationId: string;
  userId: string;
  complaintId: string;
  title: string;
  body: string;
  type: "complaint_registered" | "status_changed" | "resolved" | "assigned";
  read: boolean;
  createdAt: Timestamp;
}

// ─── AI Classification Result ────────────────────────────────
export interface ClassificationResult {
  category: string;
  department: string;
  priority: "low" | "medium" | "high" | "critical";
  confidence: number;
  matchedKeywords: string[];
}

// ─── Pagination ──────────────────────────────────────────────
export interface PaginationParams {
  limit?: number;
  startAfter?: string;
  status?: string;
  department?: string;
}
