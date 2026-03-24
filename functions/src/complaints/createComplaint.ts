import { onCall, HttpsError } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { Timestamp, GeoPoint, FieldValue } from "firebase-admin/firestore";
import { db, COLLECTIONS, REGION, COMPLAINT_STATUS, PRIORITY } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { classifyComplaint } from "../ai/classifier.js";
import { routeToDepartment } from "../departments/router.js";
import { checkDuplicate } from "../ai/duplicateDetector.js";
import type { CreateComplaintInput, Complaint, ActivityLog } from "../types.js";

/**
 * Callable: Submit a new complaint.
 * - Validates input
 * - Runs AI classification
 * - Checks for duplicates
 * - Auto-routes to department
 * - Creates activity log
 */
export const createComplaint = onCall(
  { region: REGION, maxInstances: 20 },
  async (request) => {
    const user = await requireAuth(request);
    const input = request.data as CreateComplaintInput;

    // ── Validation ──────────────────────────────────────────
    if (!input.transcript || input.transcript.trim().length < 3) {
      throw new HttpsError(
        "invalid-argument",
        "Complaint text must be at least 3 characters."
      );
    }

    if (input.transcript.length > 5000) {
      throw new HttpsError(
        "invalid-argument",
        "Complaint text cannot exceed 5000 characters."
      );
    }

    // ── Duplicate Check ─────────────────────────────────────
    const duplicate = await checkDuplicate(
      user.userId,
      input.transcript,
      input.location
    );

    if (duplicate) {
      throw new HttpsError(
        "already-exists",
        `A similar complaint was already submitted (ID: ${duplicate}). Please check your existing complaints.`
      );
    }

    // ── AI Classification ───────────────────────────────────
    const textForClassification = input.translatedText || input.transcript;
    const classification = classifyComplaint(textForClassification);
    const department = await routeToDepartment(classification.category);

    // ── Build Complaint Document ────────────────────────────
    const now = Timestamp.now();
    const complaintRef = db.collection(COLLECTIONS.COMPLAINTS).doc();

    const complaint: Omit<Complaint, "complaintId"> & { complaintId: string } = {
      complaintId: complaintRef.id,
      userId: user.userId,
      audioUrl: input.audioUrl || null,
      transcript: input.transcript,
      translatedText: input.translatedText || input.transcript,
      originalLanguage: input.originalLanguage || "en",
      category: classification.category,
      department: department,
      status: COMPLAINT_STATUS.PENDING,
      priority: classification.priority || (input.priority as Complaint["priority"]) || PRIORITY.MEDIUM,
      location: input.location
        ? new GeoPoint(input.location.lat, input.location.lng)
        : null,
      areaName: input.areaName || "",
      imageUrls: input.imageUrls || [],
      assignedOfficerId: null,
      resolutionNote: null,
      duplicateOf: null,
      createdAt: now,
      updatedAt: now,
    };

    // ── Write to Firestore (batch) ──────────────────────────
    const batch = db.batch();

    // Create complaint
    batch.set(complaintRef, complaint);

    // Create activity log
    const logRef = complaintRef.collection(COLLECTIONS.ACTIVITY_LOGS).doc();
    const activityLog: ActivityLog = {
      logId: logRef.id,
      action: "created",
      actorId: user.userId,
      actorRole: user.role,
      previousValue: null,
      newValue: COMPLAINT_STATUS.PENDING,
      note: `Complaint submitted. Category: ${classification.category}. Priority: ${classification.priority}.`,
      timestamp: now,
    };
    batch.set(logRef, activityLog);

    // Create notification for the user
    const notifRef = db.collection(COLLECTIONS.NOTIFICATIONS).doc();
    batch.set(notifRef, {
      notificationId: notifRef.id,
      userId: user.userId,
      complaintId: complaintRef.id,
      title: "Complaint Registered",
      body: `Your complaint has been registered and assigned to ${department}. Category: ${classification.category}.`,
      type: "complaint_registered",
      read: false,
      createdAt: now,
    });

    await batch.commit();

    logger.info("Complaint created", {
      complaintId: complaintRef.id,
      userId: user.userId,
      category: classification.category,
      department,
      priority: classification.priority,
    });

    return {
      success: true,
      complaintId: complaintRef.id,
      category: classification.category,
      department,
      priority: classification.priority,
      confidence: classification.confidence,
    };
  }
);
