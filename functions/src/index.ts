/**
 * CivicVoice AI — Cloud Functions Entry Point
 *
 * All functions are exported from their respective modules.
 * Firebase deploys only exported functions.
 */

import { setGlobalOptions } from "firebase-functions";
import { REGION } from "./config.js";

// ── Global Config ───────────────────────────────────────────
setGlobalOptions({ maxInstances: 10, region: REGION });

// ── Users ───────────────────────────────────────────────────
export {
  onUserCreate,
  listUsers,
  updateUserRole,
  registerFcmToken,
} from "./users/manageUsers.js";

// ── Complaints ──────────────────────────────────────────────
export { createComplaint } from "./complaints/createComplaint.js";
export { getUserComplaints } from "./complaints/getUserComplaints.js";
export { getComplaintDetails } from "./complaints/getComplaintDetails.js";
export { updateComplaintStatus } from "./complaints/updateStatus.js";

// ── AI Pipeline ─────────────────────────────────────────────
export { processAudioUpload } from "./ai/processAudio.js";

// ── Departments ─────────────────────────────────────────────
export {
  createDepartment,
  updateDepartment,
  listDepartments,
} from "./departments/manageDepartments.js";
