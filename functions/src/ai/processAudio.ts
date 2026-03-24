import { onObjectFinalized } from "firebase-functions/storage";
import * as logger from "firebase-functions/logger";
import { Timestamp } from "firebase-admin/firestore";
import { db, storage, COLLECTIONS, REGION } from "../config.js";
import { classifyComplaint } from "./classifier.js";
import { routeToDepartment } from "../departments/router.js";
import type { ActivityLog } from "../types.js";

/**
 * Storage trigger: fires when an audio file is uploaded.
 * Pipeline:
 *   1. Validate file (type, size)
 *   2. Generate signed download URL
 *   3. (Future) Call Google Cloud Speech-to-Text API
 *   4. Classify the complaint
 *   5. Update the complaint document
 *
 * NOTE: For production Speech-to-Text, enable the Google Cloud
 * Speech-to-Text API and add `@google-cloud/speech` to dependencies.
 * Currently, transcription is done client-side via Web Speech API.
 * This trigger handles post-upload processing (classification, routing).
 */
export const processAudioUpload = onObjectFinalized(
  { region: REGION, maxInstances: 5 },
  async (event) => {
    const filePath = event.data.name;
    const contentType = event.data.contentType;

    if (!filePath || !contentType) {
      logger.warn("Missing file path or content type");
      return;
    }

    // Only process audio files in the complaints directory
    if (!filePath.startsWith("complaints/") || !contentType.startsWith("audio/")) {
      logger.info("Skipping non-complaint audio file", { filePath });
      return;
    }

    // Validate file size (25 MB max)
    const sizeBytes = Number(event.data.size || 0);
    const sizeMB = sizeBytes / (1024 * 1024);
    if (sizeMB > 25) {
      logger.error("Audio file too large", { sizeMB, filePath });
      return;
    }

    // Extract complaint ID from path: complaints/{complaintId}/audio/{filename}
    const pathParts = filePath.split("/");
    if (pathParts.length < 3) {
      logger.warn("Unexpected file path format", { filePath });
      return;
    }
    const complaintId = pathParts[1];

    try {
      // ── Generate signed download URL ──────────────────────
      const bucket = storage.bucket();
      const file = bucket.file(filePath);
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
      });

      // ── Get existing complaint ────────────────────────────
      const complaintRef = db.collection(COLLECTIONS.COMPLAINTS).doc(complaintId);
      const complaintDoc = await complaintRef.get();

      if (!complaintDoc.exists) {
        logger.warn("Complaint not found for audio", { complaintId });
        return;
      }

      const complaint = complaintDoc.data()!;

      // ── Classify if not already classified ────────────────
      const textToClassify = complaint.translatedText || complaint.transcript || "";
      let category = complaint.category;
      let department = complaint.department;
      let priority = complaint.priority;

      if (textToClassify && (!category || category === "General Administration")) {
        const classification = classifyComplaint(textToClassify);
        category = classification.category;
        priority = classification.priority;
        department = await routeToDepartment(classification.category);
      }

      // ── Update complaint with audio URL and classification ─
      const now = Timestamp.now();
      await complaintRef.update({
        audioUrl: url,
        category,
        department,
        priority,
        updatedAt: now,
      });

      // ── Activity log ──────────────────────────────────────
      const logRef = complaintRef.collection(COLLECTIONS.ACTIVITY_LOGS).doc();
      const log: ActivityLog = {
        logId: logRef.id,
        action: "ai_processed",
        actorId: "system",
        actorRole: "system",
        previousValue: null,
        newValue: `Audio processed. Category: ${category}. Department: ${department}.`,
        note: null,
        timestamp: now,
      };
      await logRef.set(log);

      logger.info("Audio processed successfully", {
        complaintId,
        category,
        department,
        priority,
        audioUrl: url.substring(0, 80) + "...",
      });
    } catch (error) {
      logger.error("Audio processing failed", {
        complaintId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw — we don't want to retry on permanent errors
    }
  }
);
