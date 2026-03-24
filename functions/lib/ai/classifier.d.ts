import type { ClassificationResult } from "../types.js";
/**
 * Classify a complaint text into category, department, and priority.
 * Uses keyword-based matching with confidence scoring.
 */
export declare function classifyComplaint(text: string): ClassificationResult;
