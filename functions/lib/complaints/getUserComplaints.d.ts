/**
 * Callable: Get authenticated user's complaints with pagination.
 * Citizens see only their own. Officers/admins handled separately.
 */
export declare const getUserComplaints: import("firebase-functions/https").CallableFunction<any, Promise<{
    complaints: {
        complaintId: string;
        transcript: any;
        translatedText: any;
        category: any;
        department: any;
        status: any;
        priority: any;
        areaName: any;
        createdAt: any;
        updatedAt: any;
    }[];
    hasMore: boolean;
    lastId: string | null;
}>, unknown>;
