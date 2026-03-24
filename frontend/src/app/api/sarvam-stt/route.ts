'use server';

import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side API route to proxy audio to Sarvam AI speech-to-text-translate.
 * Keeps the API key secure (never exposed to the browser).
 *
 * POST /api/sarvam-stt
 * Body: FormData with 'file' (audio blob) and optional 'language_code'
 * Returns: { transcript, translation, language_code }
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.SARVAM_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Sarvam AI API key not configured' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get('file') as Blob | null;
    const languageCode = (formData.get('language_code') as string) || 'unknown';

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Build form data for Sarvam AI
    const sarvamForm = new FormData();
    sarvamForm.append('file', audioFile, 'audio.wav');
    sarvamForm.append('model', 'saaras:v2');

    // If a specific language is selected, pass it to Sarvam
    if (languageCode && languageCode !== 'unknown' && languageCode !== 'auto') {
      sarvamForm.append('language_code', languageCode);
    }

    // Call Sarvam AI speech-to-text-translate
    const sarvamResponse = await fetch('https://api.sarvam.ai/speech-to-text-translate', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
      },
      body: sarvamForm,
    });

    if (!sarvamResponse.ok) {
      const errorText = await sarvamResponse.text();
      console.error('[Sarvam AI] Error response:', sarvamResponse.status, errorText);
      return NextResponse.json(
        { error: `Sarvam AI API error: ${sarvamResponse.status}`, details: errorText },
        { status: sarvamResponse.status }
      );
    }

    const result = await sarvamResponse.json();

    // Sarvam AI response format:
    // { transcript: "native script text", language_code: "hi-IN", ... }
    // The speech-to-text-translate endpoint provides English translation
    return NextResponse.json({
      transcript: result.transcript || '',
      translation: result.translation || result.translated_text || '',
      language_code: result.language_code || languageCode,
    });
  } catch (error) {
    console.error('[Sarvam STT] Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error during speech processing' },
      { status: 500 }
    );
  }
}
