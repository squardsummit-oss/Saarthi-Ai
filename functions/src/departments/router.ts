import { db, COLLECTIONS } from "../config.js";

/**
 * Route a complaint to the correct department based on its category.
 * Looks up the departments collection for a department that handles this category.
 * Falls back to "General Administration" if no match found.
 */
export async function routeToDepartment(category: string): Promise<string> {
  if (!category) return "General Administration";

  // Check if any department handles this category
  const snap = await db
    .collection(COLLECTIONS.DEPARTMENTS)
    .where("isActive", "==", true)
    .where("categoriesHandled", "array-contains", category)
    .limit(1)
    .get();

  if (!snap.empty) {
    return snap.docs[0].data().name;
  }

  // Fallback: use category as department name (common in municipal setups)
  return category;
}

/**
 * Get the best officer to assign from a department.
 * Simple round-robin based on least active complaints.
 */
export async function getBestOfficer(
  departmentName: string
): Promise<string | null> {
  // Find the department
  const deptSnap = await db
    .collection(COLLECTIONS.DEPARTMENTS)
    .where("name", "==", departmentName)
    .where("isActive", "==", true)
    .limit(1)
    .get();

  if (deptSnap.empty) return null;

  const dept = deptSnap.docs[0].data();
  const officerIds: string[] = dept.officerIds || [];

  if (officerIds.length === 0) return null;

  // Find the officer with the fewest active complaints
  let bestOfficer = officerIds[0];
  let leastComplaints = Infinity;

  for (const officerId of officerIds) {
    const countSnap = await db
      .collection(COLLECTIONS.COMPLAINTS)
      .where("assignedOfficerId", "==", officerId)
      .where("status", "in", ["pending", "in-progress"])
      .limit(100)
      .get();

    if (countSnap.size < leastComplaints) {
      leastComplaints = countSnap.size;
      bestOfficer = officerId;
    }
  }

  return bestOfficer;
}
