import { onCall, HttpsError } from "firebase-functions/https";
import { db, COLLECTIONS, REGION } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import type { PaginationParams } from "../types.js";

/**
 * Callable: Get authenticated user's complaints with pagination.
 * Citizens see only their own. Officers/admins handled separately.
 */
export const getUserComplaints = onCall(
  { region: REGION, maxInstances: 10 },
  async (request) => {
    const user = await requireAuth(request);
    const params = (request.data || {}) as PaginationParams;

    const pageSize = Math.min(params.limit || 20, 50);

    let query = db.collection(COLLECTIONS.COMPLAINTS)
      .where("userId", "==", user.userId)
      .orderBy("createdAt", "desc")
      .limit(pageSize);

    // Filter by status if provided
    if (params.status) {
      query = db.collection(COLLECTIONS.COMPLAINTS)
        .where("userId", "==", user.userId)
        .where("status", "==", params.status)
        .orderBy("createdAt", "desc")
        .limit(pageSize);
    }

    // Cursor-based pagination
    if (params.startAfter) {
      const lastDoc = await db
        .collection(COLLECTIONS.COMPLAINTS)
        .doc(params.startAfter)
        .get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snap = await query.get();

    return {
      complaints: snap.docs.map((doc) => {
        const d = doc.data();
        return {
          complaintId: doc.id,
          transcript: d.transcript,
          translatedText: d.translatedText,
          category: d.category,
          department: d.department,
          status: d.status,
          priority: d.priority,
          areaName: d.areaName,
          createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: d.updatedAt?.toDate?.()?.toISOString() || null,
        };
      }),
      hasMore: snap.size === pageSize,
      lastId: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1].id : null,
    };
  }
);
