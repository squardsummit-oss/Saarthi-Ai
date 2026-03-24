/**
 * Check for duplicate complaints from the same user.
 * Criteria: same user + similar category/text + within DUPLICATE_WINDOW_HOURS.
 *
 * Returns the duplicate complaint ID if found, null otherwise.
 */
export declare function checkDuplicate(userId: string, transcript: string, location?: {
    lat: number;
    lng: number;
} | null): Promise<string | null>;
