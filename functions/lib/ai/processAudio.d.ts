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
export declare const processAudioUpload: import("firebase-functions").CloudFunction<import("firebase-functions/storage").StorageEvent>;
