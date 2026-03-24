/**
 * Route a complaint to the correct department based on its category.
 * Looks up the departments collection for a department that handles this category.
 * Falls back to "General Administration" if no match found.
 */
export declare function routeToDepartment(category: string): Promise<string>;
/**
 * Get the best officer to assign from a department.
 * Simple round-robin based on least active complaints.
 */
export declare function getBestOfficer(departmentName: string): Promise<string | null>;
