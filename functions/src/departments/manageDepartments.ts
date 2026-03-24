import { onCall, HttpsError } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
// Timestamp not needed in this module
import { db, COLLECTIONS, REGION } from "../config.js";
import { requireAdmin } from "../middleware/auth.js";
import type { CreateDepartmentInput } from "../types.js";

/**
 * Admin-only: Create a new department.
 */
export const createDepartment = onCall(
  { region: REGION, maxInstances: 5 },
  async (request) => {
    await requireAdmin(request);
    const input = request.data as CreateDepartmentInput;

    if (!input.name || input.name.trim().length < 2) {
      throw new HttpsError("invalid-argument", "Department name is required (min 2 chars).");
    }

    if (!input.categoriesHandled || input.categoriesHandled.length === 0) {
      throw new HttpsError("invalid-argument", "At least one category must be specified.");
    }

    // Check for duplicate name
    const existing = await db
      .collection(COLLECTIONS.DEPARTMENTS)
      .where("name", "==", input.name.trim())
      .limit(1)
      .get();

    if (!existing.empty) {
      throw new HttpsError("already-exists", `Department "${input.name}" already exists.`);
    }

    const ref = db.collection(COLLECTIONS.DEPARTMENTS).doc();
    await ref.set({
      departmentId: ref.id,
      name: input.name.trim(),
      categoriesHandled: input.categoriesHandled,
      officerIds: [],
      contactEmail: input.contactEmail || "",
      isActive: true,
    });

    logger.info("Department created", { id: ref.id, name: input.name });
    return { success: true, departmentId: ref.id };
  }
);

/**
 * Admin-only: Update department details.
 */
export const updateDepartment = onCall(
  { region: REGION, maxInstances: 5 },
  async (request) => {
    await requireAdmin(request);

    const { departmentId, ...updates } = request.data as {
      departmentId: string;
      name?: string;
      categoriesHandled?: string[];
      contactEmail?: string;
      isActive?: boolean;
      officerIds?: string[];
    };

    if (!departmentId) {
      throw new HttpsError("invalid-argument", "departmentId is required.");
    }

    const ref = db.collection(COLLECTIONS.DEPARTMENTS).doc(departmentId);
    const doc = await ref.get();

    if (!doc.exists) {
      throw new HttpsError("not-found", "Department not found.");
    }

    const safeUpdates: Record<string, unknown> = {};
    if (updates.name) safeUpdates.name = updates.name.trim();
    if (updates.categoriesHandled) safeUpdates.categoriesHandled = updates.categoriesHandled;
    if (updates.contactEmail !== undefined) safeUpdates.contactEmail = updates.contactEmail;
    if (updates.isActive !== undefined) safeUpdates.isActive = updates.isActive;
    if (updates.officerIds) safeUpdates.officerIds = updates.officerIds;

    await ref.update(safeUpdates);
    logger.info("Department updated", { departmentId, updates: safeUpdates });

    return { success: true, departmentId };
  }
);

/**
 * Any authenticated user: List all active departments.
 */
export const listDepartments = onCall(
  { region: REGION, maxInstances: 5 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const snap = await db
      .collection(COLLECTIONS.DEPARTMENTS)
      .where("isActive", "==", true)
      .orderBy("name")
      .get();

    return {
      departments: snap.docs.map((doc) => ({
        departmentId: doc.id,
        name: doc.data().name,
        categoriesHandled: doc.data().categoriesHandled,
        officerCount: (doc.data().officerIds || []).length,
      })),
    };
  }
);
