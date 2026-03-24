import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { text, sourceLang } = await req.json();
    
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    // Detect source language from text if not provided
    let srcLang = sourceLang || 'auto';
    if (srcLang === 'auto' || !srcLang) {
      if (/[\u0C00-\u0C7F]/.test(text)) srcLang = 'te';
      else if (/[\u0900-\u097F]/.test(text)) srcLang = 'hi';
      else srcLang = 'en';
    }

    // If already English, return as-is
    if (srcLang === 'en' || srcLang === 'English') {
      return NextResponse.json({ translated: text, sourceLang: 'English' });
    }

    // Map to MyMemory API language codes
    const langMap: Record<string, string> = {
      'te': 'te-IN',
      'hi': 'hi-IN',
      'Telugu': 'te-IN',
      'Hindi': 'hi-IN',
      'te-IN': 'te-IN',
      'hi-IN': 'hi-IN',
    };
    
    const from = langMap[srcLang] || 'te-IN';
    const targetLang = 'en-GB';

    // Use MyMemory Translation API (free, no key needed, supports Telugu)
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${targetLang}`;
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'SAARTHI-AI/1.0' },
    });

    if (!response.ok) {
      throw new Error(`Translation API returned ${response.status}`);
    }

    const data = await response.json();
    
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      let translated = data.responseData.translatedText;
      
      // MyMemory sometimes returns the original text in uppercase when it can't translate
      // In that case, try the matches array for better alternatives
      if (translated === text.toUpperCase() && data.matches && data.matches.length > 1) {
        const betterMatch = data.matches.find(
          (m: { translation: string; quality: string }) => 
            m.translation !== text.toUpperCase() && parseInt(m.quality) > 50
        );
        if (betterMatch) {
          translated = betterMatch.translation;
        }
      }

      return NextResponse.json({ 
        translated, 
        sourceLang: srcLang === 'te' || srcLang === 'te-IN' ? 'Telugu' : 'Hindi',
      });
    }

    // Fallback: return original text if translation fails
    return NextResponse.json({ 
      translated: text, 
      sourceLang: 'Unknown',
      warning: 'Translation service returned unexpected response',
    });

  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'Translation failed', translated: '' },
      { status: 500 }
    );
  }
}
