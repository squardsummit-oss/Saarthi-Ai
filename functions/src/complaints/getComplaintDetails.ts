import { onCall, HttpsError } from "firebase-functions/https";
import { db, COLLECTIONS, REGION, USER_ROLES } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { verifyDepartmentAccess } from "../middleware/auth.js";

/**
 * Callable: Get a single complaint with its activity logs.
 * Role-based: citizens see own, officers see their dept, admin sees all.
 */
export const getComplaintDetails = onCall(
  { region: REGION, maxInstances: 10 },
  async (request) => {
    const user = await requireAuth(request);
    const { complaintId } = request.data as { complaintId: string };

    if (!complaintId) {
      throw new HttpsError("invalid-argument", "complaintId is required.");
    }

    // Get complaint
    const doc = await db
      .collection(COLLECTIONS.COMPLAINTS)
      .doc(complaintId)
      .get();

    if (!doc.exists) {
      throw new HttpsError("not-found", "Complaint not found.");
    }

    const complaint = doc.data()!;

    // ── Access Control ──────────────────────────────────────
    if (user.role === USER_ROLES.CITIZEN && complaint.userId !== user.userId) {
      throw new HttpsError(
        "permission-denied",
        "You can only view your own complaints."
      );
    }

    if (user.role === USER_ROLES.OFFICER) {
      await verifyDepartmentAccess(user, complaint.department);
    }

    // ── Get Activity Logs ───────────────────────────────────
    const logsSnap = await doc.ref
      .collection(COLLECTIONS.ACTIVITY_LOGS)
      .orderBy("timestamp", "desc")
      .limit(50)
      .get();

    const logs = logsSnap.docs.map((logDoc) => {
      const l = logDoc.data();
      return {
        logId: logDoc.id,
        action: l.action,
        actorId: l.actorId,
        actorRole: l.actorRole,
        previousValue: l.previousValue,
        newValue: l.newValue,
        note: l.note,
        timestamp: l.timestamp?.toDate?.()?.toISOString() || null,
      };
    });

    return {
      complaint: {
        complaintId: doc.id,
        userId: complaint.userId,
        transcript: complaint.transcript,
        translatedText: complaint.translatedText,
        originalLanguage: complaint.originalLanguage,
        category: complaint.category,
        department: complaint.department,
        status: complaint.status,
        priority: complaint.priority,
        areaName: complaint.areaName,
        audioUrl: complaint.audioUrl,
        imageUrls: complaint.imageUrls,
        assignedOfficerId: complaint.assignedOfficerId,
        resolutionNote: complaint.resolutionNote,
        location: complaint.location
          ? {
              lat: complaint.location.latitude,
              lng: complaint.location.longitude,
            }
          : null,
        createdAt: complaint.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: complaint.updatedAt?.toDate?.()?.toISOString() || null,
      },
      activityLogs: logs,
    };
  }
);
