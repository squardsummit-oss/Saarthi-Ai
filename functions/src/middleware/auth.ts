import { HttpsError, type CallableRequest } from "firebase-functions/https";
import { db, COLLECTIONS, USER_ROLES } from "../config.js";
import type { UserProfile } from "../types.js";

/**
 * Verify that the request is authenticated and return the user profile.
 * Throws UNAUTHENTICATED if no auth context.
 */
export async function requireAuth(
  request: CallableRequest
): Promise<UserProfile> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const uid = request.auth.uid;
  const userDoc = await db.collection(COLLECTIONS.USERS).doc(uid).get();

  if (!userDoc.exists) {
    throw new HttpsError(
      "not-found",
      "User profile not found. Please complete registration."
    );
  }

  return userDoc.data() as UserProfile;
}

/**
 * Verify that the authenticated user has one of the required roles.
 * Returns the user profile if authorized.
 */
export async function requireRole(
  request: CallableRequest,
  allowedRoles: string[]
): Promise<UserProfile> {
  const user = await requireAuth(request);

  if (!allowedRoles.includes(user.role)) {
    throw new HttpsError(
      "permission-denied",
      `Access denied. Required role: ${allowedRoles.join(" or ")}. Your role: ${user.role}.`
    );
  }

  return user;
}

/**
 * Verify the user is an admin.
 */
export async function requireAdmin(
  request: CallableRequest
): Promise<UserProfile> {
  return requireRole(request, [USER_ROLES.ADMIN]);
}

/**
 * Verify the user is an officer or admin.
 */
export async function requireOfficerOrAdmin(
  request: CallableRequest
): Promise<UserProfile> {
  return requireRole(request, [USER_ROLES.OFFICER, USER_ROLES.ADMIN]);
}

/**
 * Check if an officer is assigned to the complaint's department.
 */
export async function verifyDepartmentAccess(
  user: UserProfile,
  complaintDepartment: string
): Promise<void> {
  if (user.role === USER_ROLES.ADMIN) return; // Admin has full access

  if (user.role === USER_ROLES.OFFICER) {
    if (!user.departmentId) {
      throw new HttpsError(
        "permission-denied",
        "Officer is not assigned to any department."
      );
    }

    // Get the department to check if it handles this complaint's department
    const deptDoc = await db
      .collection(COLLECTIONS.DEPARTMENTS)
      .doc(user.departmentId)
      .get();

    if (!deptDoc.exists) {
      throw new HttpsError("not-found", "Department not found.");
    }

    const dept = deptDoc.data();
    if (dept && dept.name !== complaintDepartment) {
      throw new HttpsError(
        "permission-denied",
        "You can only access complaints assigned to your department."
      );
    }
  }
}
