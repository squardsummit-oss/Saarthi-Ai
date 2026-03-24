/**
 * Admin-only: Create a new department.
 */
export declare const createDepartment: import("firebase-functions/https").CallableFunction<any, Promise<{
    success: boolean;
    departmentId: string;
}>, unknown>;
/**
 * Admin-only: Update department details.
 */
export declare const updateDepartment: import("firebase-functions/https").CallableFunction<any, Promise<{
    success: boolean;
    departmentId: string;
}>, unknown>;
/**
 * Any authenticated user: List all active departments.
 */
export declare const listDepartments: import("firebase-functions/https").CallableFunction<any, Promise<{
    departments: {
        departmentId: string;
        name: any;
        categoriesHandled: any;
        officerCount: any;
    }[];
}>, unknown>;
