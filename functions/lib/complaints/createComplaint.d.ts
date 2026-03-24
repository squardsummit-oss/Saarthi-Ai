/**
 * Callable: Submit a new complaint.
 * - Validates input
 * - Runs AI classification
 * - Checks for duplicates
 * - Auto-routes to department
 * - Creates activity log
 */
export declare const createComplaint: import("firebase-functions/https").CallableFunction<any, Promise<{
    success: boolean;
    complaintId: string;
    category: string;
    department: string;
    priority: "low" | "medium" | "high" | "critical";
    confidence: number;
}>, unknown>;
