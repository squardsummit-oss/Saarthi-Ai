import { db, COLLECTIONS, DUPLICATE_WINDOW_HOURS } from "../config.js";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Check for duplicate complaints from the same user.
 * Criteria: same user + similar category/text + within DUPLICATE_WINDOW_HOURS.
 *
 * Returns the duplicate complaint ID if found, null otherwise.
 */
export async function checkDuplicate(
  userId: string,
  transcript: string,
  location?: { lat: number; lng: number } | null
): Promise<string | null> {
  const windowStart = Timestamp.fromDate(
    new Date(Date.now() - DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000)
  );

  // Query recent complaints from same user
  const recentSnap = await db
    .collection(COLLECTIONS.COMPLAINTS)
    .where("userId", "==", userId)
    .where("createdAt", ">=", windowStart)
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();

  if (recentSnap.empty) return null;

  // Normalize text for comparison
  const normalizedInput = normalizeText(transcript);

  for (const doc of recentSnap.docs) {
    const existing = doc.data();
    const existingNormalized = normalizeText(existing.transcript || "");

    // Check text similarity (Jaccard index)
    const similarity = jaccardSimilarity(normalizedInput, existingNormalized);

    if (similarity > 0.6) {
      // High text similarity — likely duplicate
      return doc.id;
    }

    // If location is provided, check proximity (within 200m)
    if (
      location &&
      existing.location &&
      typeof existing.location.latitude === "number"
    ) {
      const distance = haversineDistance(
        location.lat,
        location.lng,
        existing.location.latitude,
        existing.location.longitude
      );
      if (distance < 200 && similarity > 0.3) {
        // Close location + moderate text similarity
        return doc.id;
      }
    }
  }

  return null;
}

/**
 * Normalize text: lowercase, remove punctuation, collapse whitespace.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Jaccard similarity between two strings (word-level).
 */
function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(" ").filter(Boolean));
  const setB = new Set(b.split(" ").filter(Boolean));

  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Haversine distance between two lat/lng points (in meters).
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
