import { onCall, HttpsError } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { Timestamp } from "firebase-admin/firestore";
import { db, COLLECTIONS, REGION, COMPLAINT_STATUS } from "../config.js";
import { requireOfficerOrAdmin, verifyDepartmentAccess } from "../middleware/auth.js";
import { sendComplaintNotification } from "../notifications/sendNotification.js";
import type { UpdateStatusInput, ActivityLog } from "../types.js";

const VALID_STATUSES = Object.values(COMPLAINT_STATUS);

/**
 * Callable: Update complaint status (officer/admin only).
 * - Validates status transition
 * - Creates activity log
 * - Sends notification to the complaint owner
 */
export const updateComplaintStatus = onCall(
  { region: REGION, maxInstances: 10 },
  async (request) => {
    const user = await requireOfficerOrAdmin(request);
    const input = request.data as UpdateStatusInput;

    // ── Validation ──────────────────────────────────────────
    if (!input.complaintId) {
      throw new HttpsError("invalid-argument", "complaintId is required.");
    }

    if (!input.status || !VALID_STATUSES.includes(input.status as typeof COMPLAINT_STATUS[keyof typeof COMPLAINT_STATUS])) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`
      );
    }

    // ── Get Complaint ───────────────────────────────────────
    const complaintRef = db.collection(COLLECTIONS.COMPLAINTS).doc(input.complaintId);
    const complaintDoc = await complaintRef.get();

    if (!complaintDoc.exists) {
      throw new HttpsError("not-found", "Complaint not found.");
    }

    const complaint = complaintDoc.data()!;
    const previousStatus = complaint.status;

    // ── Department Access Check ─────────────────────────────
    await verifyDepartmentAccess(user, complaint.department);

    // ── Prevent redundant updates ───────────────────────────
    if (previousStatus === input.status) {
      throw new HttpsError(
        "failed-precondition",
        `Complaint is already in "${input.status}" status.`
      );
    }

    // ── Update Complaint ────────────────────────────────────
    const now = Timestamp.now();
    const batch = db.batch();

    const updates: Record<string, unknown> = {
      status: input.status,
      updatedAt: now,
    };

    if (input.resolutionNote) {
      updates.resolutionNote = input.resolutionNote;
    }

    if (input.assignedOfficerId) {
      updates.assignedOfficerId = input.assignedOfficerId;
    }

    batch.update(complaintRef, updates);

    // ── Activity Log ────────────────────────────────────────
    const logRef = complaintRef.collection(COLLECTIONS.ACTIVITY_LOGS).doc();
    const log: ActivityLog = {
      logId: logRef.id,
      action: "status_changed",
      actorId: user.userId,
      actorRole: user.role,
      previousValue: previousStatus,
      newValue: input.status,
      note: input.resolutionNote || null,
      timestamp: now,
    };
    batch.set(logRef, log);

    // ── Notification for complaint owner ────────────────────
    const statusLabels: Record<string, string> = {
      "in-progress": "is now being worked on",
      "resolved": "has been resolved",
      "rejected": "has been rejected",
      "pending": "has been set back to pending",
    };

    const notifRef = db.collection(COLLECTIONS.NOTIFICATIONS).doc();
    batch.set(notifRef, {
      notificationId: notifRef.id,
      userId: complaint.userId,
      complaintId: input.complaintId,
      title: `Complaint ${input.status === "resolved" ? "Resolved ✅" : "Updated"}`,
      body: `Your ${complaint.category} complaint ${statusLabels[input.status] || "status updated"}.${input.resolutionNote ? " Note: " + input.resolutionNote : ""}`,
      type: input.status === "resolved" ? "resolved" : "status_changed",
      read: false,
      createdAt: now,
    });

    await batch.commit();

    // ── Send FCM Push (non-blocking) ────────────────────────
    sendComplaintNotification(
      complaint.userId,
      input.complaintId,
      `Complaint ${input.status === "resolved" ? "Resolved" : "Updated"}`,
      `Your ${complaint.category} complaint ${statusLabels[input.status] || "was updated"}.`
    ).catch((err) => logger.error("FCM send failed", err));

    logger.info("Complaint status updated", {
      complaintId: input.complaintId,
      from: previousStatus,
      to: input.status,
      by: user.userId,
    });

    return {
      success: true,
      complaintId: input.complaintId,
      previousStatus,
      newStatus: input.status,
    };
  }
);
