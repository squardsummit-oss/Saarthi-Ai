/**
 * Client-side translation utility using MyMemory Translation API (free, no key needed).
 * Supports Telugu, Hindi, Tamil, Malayalam, Kannada → English.
 */

const LANG_MAP: Record<string, string> = {
  te: 'te-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  ml: 'ml-IN',
  kn: 'kn-IN',
  Telugu: 'te-IN',
  Hindi: 'hi-IN',
  Tamil: 'ta-IN',
  Malayalam: 'ml-IN',
  Kannada: 'kn-IN',
  'te-IN': 'te-IN',
  'hi-IN': 'hi-IN',
  'ta-IN': 'ta-IN',
  'ml-IN': 'ml-IN',
  'kn-IN': 'kn-IN',
};

const LANG_NAMES: Record<string, string> = {
  'te': 'Telugu', 'te-IN': 'Telugu',
  'hi': 'Hindi', 'hi-IN': 'Hindi',
  'ta': 'Tamil', 'ta-IN': 'Tamil',
  'ml': 'Malayalam', 'ml-IN': 'Malayalam',
  'kn': 'Kannada', 'kn-IN': 'Kannada',
};

export async function translateText(
  text: string,
  sourceLang?: string
): Promise<{ translated: string; sourceLang: string; warning?: string }> {
  if (!text || typeof text !== 'string') {
    return { translated: '', sourceLang: 'Unknown', warning: 'Missing text' };
  }

  // Detect source language from Unicode ranges
  let srcLang = sourceLang || 'auto';
  if (srcLang === 'auto' || !srcLang) {
    if (/[\u0C00-\u0C7F]/.test(text)) srcLang = 'te';
    else if (/[\u0900-\u097F]/.test(text)) srcLang = 'hi';
    else if (/[\u0B80-\u0BFF]/.test(text)) srcLang = 'ta';
    else if (/[\u0D00-\u0D7F]/.test(text)) srcLang = 'ml';
    else if (/[\u0C80-\u0CFF]/.test(text)) srcLang = 'kn';
    else srcLang = 'en';
  }

  // Already English — return as-is
  if (srcLang === 'en' || srcLang === 'English') {
    return { translated: text, sourceLang: 'English' };
  }

  const from = LANG_MAP[srcLang] || 'te-IN';
  const targetLang = 'en-GB';
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${targetLang}`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'SAARTHI-AI/1.0' },
    });

    if (!response.ok) {
      throw new Error(`Translation API returned ${response.status}`);
    }

    const data = await response.json();

    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      let translated = data.responseData.translatedText;

      // MyMemory sometimes returns original text uppercased when it can't translate
      if (translated === text.toUpperCase() && data.matches && data.matches.length > 1) {
        const betterMatch = data.matches.find(
          (m: { translation: string; quality: string }) =>
            m.translation !== text.toUpperCase() && parseInt(m.quality) > 50
        );
        if (betterMatch) {
          translated = betterMatch.translation;
        }
      }

      return {
        translated,
        sourceLang: LANG_NAMES[srcLang] || srcLang,
      };
    }

    return {
      translated: text,
      sourceLang: 'Unknown',
      warning: 'Translation service returned unexpected response',
    };
  } catch (error) {
    console.error('Translation error:', error);
    return { translated: '', sourceLang: 'Unknown', warning: 'Translation failed' };
  }
}
