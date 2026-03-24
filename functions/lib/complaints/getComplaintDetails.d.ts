/**
 * Callable: Get a single complaint with its activity logs.
 * Role-based: citizens see own, officers see their dept, admin sees all.
 */
export declare const getComplaintDetails: import("firebase-functions/https").CallableFunction<any, Promise<{
    complaint: {
        complaintId: string;
        userId: any;
        transcript: any;
        translatedText: any;
        originalLanguage: any;
        category: any;
        department: any;
        status: any;
        priority: any;
        areaName: any;
        audioUrl: any;
        imageUrls: any;
        assignedOfficerId: any;
        resolutionNote: any;
        location: {
            lat: any;
            lng: any;
        } | null;
        createdAt: any;
        updatedAt: any;
    };
    activityLogs: {
        logId: string;
        action: any;
        actorId: any;
        actorRole: any;
        previousValue: any;
        newValue: any;
        note: any;
        timestamp: any;
    }[];
}>, unknown>;
