/**
 * Callable: Update complaint status (officer/admin only).
 * - Validates status transition
 * - Creates activity log
 * - Sends notification to the complaint owner
 */
export declare const updateComplaintStatus: import("firebase-functions/https").CallableFunction<any, Promise<{
    success: boolean;
    complaintId: string;
    previousStatus: any;
    newStatus: string;
}>, unknown>;
