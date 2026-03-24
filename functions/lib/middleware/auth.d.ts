import { type CallableRequest } from "firebase-functions/https";
import type { UserProfile } from "../types.js";
/**
 * Verify that the request is authenticated and return the user profile.
 * Throws UNAUTHENTICATED if no auth context.
 */
export declare function requireAuth(request: CallableRequest): Promise<UserProfile>;
/**
 * Verify that the authenticated user has one of the required roles.
 * Returns the user profile if authorized.
 */
export declare function requireRole(request: CallableRequest, allowedRoles: string[]): Promise<UserProfile>;
/**
 * Verify the user is an admin.
 */
export declare function requireAdmin(request: CallableRequest): Promise<UserProfile>;
/**
 * Verify the user is an officer or admin.
 */
export declare function requireOfficerOrAdmin(request: CallableRequest): Promise<UserProfile>;
/**
 * Check if an officer is assigned to the complaint's department.
 */
export declare function verifyDepartmentAccess(user: UserProfile, complaintDepartment: string): Promise<void>;
