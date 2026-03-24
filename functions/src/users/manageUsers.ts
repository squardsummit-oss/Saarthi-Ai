import { beforeUserCreated } from "firebase-functions/identity";
import { onCall } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { Timestamp } from "firebase-admin/firestore";
import { db, COLLECTIONS, REGION, USER_ROLES } from "../config.js";
import { requireAdmin } from "../middleware/auth.js";
import type { UserProfile } from "../types.js";

/**
 * Auth Blocking Function — runs before user creation completes.
 * Creates user profile in Firestore with default "citizen" role.
 */
export const onUserCreate = beforeUserCreated(
  { region: REGION },
  async (event) => {
    const user = event.data;
    if (!user) return;

    const now = Timestamp.now();
    const profile: UserProfile = {
      userId: user.uid,
      name: user.displayName || user.email?.split("@")[0] || "User",
      phone: user.phoneNumber || "",
      email: user.email || null,
      role: USER_ROLES.CITIZEN,
      departmentId: null,
      fcmTokens: [],
      language: "en",
      createdAt: now,
      updatedAt: now,
    };

    await db.collection(COLLECTIONS.USERS).doc(user.uid).set(profile);
    logger.info(`User profile created for ${user.uid}`, { role: "citizen" });
  }
);

/**
 * Admin-only: List all users with optional role filter.
 */
export const listUsers = onCall(
  { region: REGION, maxInstances: 5 },
  async (request) => {
    await requireAdmin(request);

    const role = request.data?.role as string | undefined;
    const limitCount = Math.min(request.data?.limit || 50, 100);

    let query = db.collection(COLLECTIONS.USERS)
      .orderBy("createdAt", "desc")
      .limit(limitCount);

    if (role && Object.values(USER_ROLES).includes(role as typeof USER_ROLES[keyof typeof USER_ROLES])) {
      query = db.collection(COLLECTIONS.USERS)
        .where("role", "==", role)
        .orderBy("createdAt", "desc")
        .limit(limitCount);
    }

    const snap = await query.get();
    return {
      users: snap.docs.map((doc) => {
        const data = doc.data();
        return {
          userId: doc.id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          role: data.role,
          departmentId: data.departmentId,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        };
      }),
      count: snap.size,
    };
  }
);

/**
 * Admin-only: Update a user's role and/or department assignment.
 */
export const updateUserRole = onCall(
  { region: REGION, maxInstances: 5 },
  async (request) => {
    await requireAdmin(request);

    const { userId, role, departmentId } = request.data as {
      userId: string;
      role?: string;
      departmentId?: string;
    };

    if (!userId) {
      throw new Error("userId is required");
    }

    const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new Error("User not found");
    }

    const updates: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    if (role && Object.values(USER_ROLES).includes(role as typeof USER_ROLES[keyof typeof USER_ROLES])) {
      updates.role = role;
    }

    if (departmentId !== undefined) {
      updates.departmentId = departmentId || null;
    }

    await userRef.update(updates);
    logger.info(`User ${userId} updated`, updates);

    return { success: true, userId, updates };
  }
);

/**
 * Any user: Register FCM token for push notifications.
 */
export const registerFcmToken = onCall(
  { region: REGION, maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new Error("Authentication required");
    }

    const { token } = request.data as { token: string };
    if (!token) throw new Error("FCM token is required");

    const userRef = db.collection(COLLECTIONS.USERS).doc(request.auth.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new Error("User profile not found");
    }

    const existing = userDoc.data()?.fcmTokens || [];
    if (!existing.includes(token)) {
      await userRef.update({
        fcmTokens: [...existing, token],
        updatedAt: Timestamp.now(),
      });
    }

    return { success: true };
  }
);
