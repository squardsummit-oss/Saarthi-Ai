'use client';

import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, Loader2, Globe, MessageSquare, Languages, Brain, Building2 } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { NotificationProvider } from '@/components/NotificationProvider';
import { db } from '../../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { translateText as translateTextClient } from '@/lib/translate';

interface ServiceSector {
  id: string;
  name: string;
  keywords: string[];
  icon: string;
  contactInfo: string;
}

const steps = [
  { icon: Globe, label: 'Detecting Language...', doneLabel: 'Language Detected' },
  { icon: MessageSquare, label: 'Converting Speech...', doneLabel: 'Speech Converted' },
  { icon: Languages, label: 'Translating to English...', doneLabel: 'Translation Complete' },
  { icon: Brain, label: 'Classifying Issue...', doneLabel: 'Issue Classified' },
  { icon: Building2, label: 'Assigning Department...', doneLabel: 'Department Assigned' },
];

function classifyWithSectors(
  text: string,
  sectors: ServiceSector[]
): { category: string; department: string; departmentEmail: string; urgency: string; emotion: string; matchedKeywords: string[]; confidence: number } {
  const lower = text.toLowerCase();
  let urgency = 'Medium';
  let emotion = 'Neutral';

  // Dynamic keyword matching against sectors from admin knowledge base
  let bestSector: ServiceSector | null = null;
  let bestCount = 0;
  let bestMatched: string[] = [];

  for (const sector of sectors) {
    const matched: string[] = [];
    for (const kw of sector.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        matched.push(kw);
      }
    }
    if (matched.length > bestCount) {
      bestCount = matched.length;
      bestSector = sector;
      bestMatched = matched;
    }
  }

  const category = bestSector ? bestSector.name : 'General Administration';
  const department = bestSector ? bestSector.name : 'General Administration';
  const departmentEmail = bestSector ? bestSector.contactInfo : '';
  const confidence = bestSector ? Math.min(100, bestCount * 25 + 25) : 10;

  // Urgency detection
  if (/urgent|emergency|danger|critical|immediate|sos|death|flood/i.test(lower)) urgency = 'High';
  else if (/minor|small|little|slightly/i.test(lower)) urgency = 'Low';

  // Emotion detection
  if (/angry|furious|terrible|worst|disgusted|fed up|outrageous/i.test(lower)) emotion = 'Angry';
  else if (/worried|scared|afraid|anxious|concerned/i.test(lower)) emotion = 'Anxious';
  else if (/happy|grateful|thank/i.test(lower)) emotion = 'Positive';

  if (emotion === 'Angry') urgency = 'High';

  return { category, department, departmentEmail, urgency, emotion, matchedKeywords: bestMatched, confidence };
}

function ProcessingFlow() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawText = searchParams.get('text') || '';
  const lang = searchParams.get('lang') || 'auto';
  const isSos = searchParams.get('sos') === 'true';
  const detectedLangParam = searchParams.get('detectedLang') || '';
  const srcLangParam = searchParams.get('srcLang') || '';
  const sarvamTranslationParam = searchParams.get('sarvamTranslation') || '';

  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(false);
  const [sectors, setSectors] = useState<ServiceSector[]>([]);
  const [sectorsLoaded, setSectorsLoaded] = useState(false);
  const [result, setResult] = useState<{
    detectedLang: string;
    original: string;
    translated: string;
    category: string;
    department: string;
    departmentEmail: string;
    urgency: string;
    emotion: string;
    matchedKeywords: string[];
    confidence: number;
  } | null>(null);

  // Fetch service sectors from Firestore FIRST, then start processing
  useEffect(() => {
    const fetchSectors = async () => {
      try {
        const snap = await getDocs(collection(db, 'serviceSectors'));
        const data: ServiceSector[] = [];
        snap.forEach(d => data.push({ id: d.id, ...d.data() } as ServiceSector));
        setSectors(data);
        console.log(`[AI Router] Loaded ${data.length} service sectors from admin knowledge base`);
      } catch (err) {
        console.error('Failed to fetch service sectors:', err);
      }
      setSectorsLoaded(true);
    };
    fetchSectors();
  }, []);

  // Translate text using client-side utility (no server route needed)
  const translateText = useCallback(async (text: string, srcLang: string): Promise<{ translated: string; sourceLang: string }> => {
    // If already English, return as-is
    if (srcLang === 'en' || srcLang === 'English') {
      return { translated: text, sourceLang: 'English' };
    }
    // Check if text is Latin characters only (already English)
    if (!/[\u0900-\u097F\u0C00-\u0C7F]/.test(text) && /^[\x00-\x7F\s]+$/.test(text)) {
      return { translated: text, sourceLang: 'English' };
    }
    const result = await translateTextClient(text, srcLang);
    return { translated: result.translated || text, sourceLang: result.sourceLang || srcLang };
  }, []);

  // Only start processing AFTER sectors are loaded
  useEffect(() => {
    if (!sectorsLoaded) return;

    const originalText = decodeURIComponent(rawText);
    let cancelled = false;

    // Detect language — priority: srcLang (from speech recognition) > detectedLangParam > lang code > Unicode
    let detectedLang = '';
    const langCodeMap: Record<string, string> = {
      te: 'Telugu', hi: 'Hindi', en: 'English',
      ta: 'Tamil', ml: 'Malayalam', kn: 'Kannada',
    };

    if (srcLangParam && langCodeMap[srcLangParam]) {
      detectedLang = langCodeMap[srcLangParam];
    } else if (detectedLangParam) {
      detectedLang = detectedLangParam;
    } else if (lang !== 'auto' && langCodeMap[lang]) {
      detectedLang = langCodeMap[lang];
    } else {
      if (/[\u0C00-\u0C7F]/.test(originalText)) detectedLang = 'Telugu';
      else if (/[\u0900-\u097F]/.test(originalText)) detectedLang = 'Hindi';
      else if (/[\u0B80-\u0BFF]/.test(originalText)) detectedLang = 'Tamil';
      else if (/[\u0D00-\u0D7F]/.test(originalText)) detectedLang = 'Malayalam';
      else if (/[\u0C80-\u0CFF]/.test(originalText)) detectedLang = 'Kannada';
      else detectedLang = 'English';
    }

    // Use the most specific source language for translation
    const translationSrcLang = srcLangParam || detectedLang;

    // If Sarvam AI already provided a translation, use it directly — much faster & more accurate
    const sarvamTranslation = sarvamTranslationParam ? decodeURIComponent(sarvamTranslationParam) : '';
    const translationPromise = sarvamTranslation
      ? Promise.resolve({ translated: sarvamTranslation, sourceLang: detectedLang })
      : translateText(originalText, translationSrcLang);

    // Animate steps
    let step = 0;
    const timer = setInterval(async () => {
      if (cancelled) { clearInterval(timer); return; }
      step++;
      if (step >= steps.length) {
        clearInterval(timer);

        // Wait for translation to complete
        const { translated } = await translationPromise;
        if (cancelled) return;

        // Classify complaint — use English translation for keyword matching if available
        const textForClassification = translated || originalText;
        const { category, department, departmentEmail, urgency, emotion, matchedKeywords, confidence } = classifyWithSectors(textForClassification, sectors);

        setResult({
          detectedLang,
          original: originalText,
          translated,
          category,
          department,
          departmentEmail,
          urgency: isSos ? 'Critical' : urgency,
          emotion,
          matchedKeywords,
          confidence,
        });
        setDone(true);
      } else {
        setCurrentStep(step);
      }
    }, 1000);

    return () => { cancelled = true; clearInterval(timer); };
  }, [sectorsLoaded, rawText, lang, isSos, sectors, detectedLangParam, srcLangParam, sarvamTranslationParam, translateText]);

  const handleConfirm = () => {
    if (result) {
      const params = new URLSearchParams({
        original: result.original,
        translated: result.translated,
        category: result.category,
        department: result.department,
        departmentEmail: result.departmentEmail,
        urgency: result.urgency,
        emotion: result.emotion,
        lang: result.detectedLang,
        matchedKeywords: result.matchedKeywords.join(','),
        confidence: String(result.confidence),
      });
      router.push(`/confirm?${params.toString()}`);
    }
  };

  return (
    <div className="page-container" style={{ paddingTop: 40 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>
        {done ? '✅ Analysis Complete' : '🧠 AI Processing'}
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center', marginBottom: 40 }}>
        {done ? 'Review the results below' : !sectorsLoaded ? 'Loading service sectors...' : 'Analyzing your complaint...'}
      </p>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 40 }}>
        {steps.map((step, i) => {
          const isDone = i < currentStep || done;
          const isActive = i === currentStep && !done && sectorsLoaded;
          const Icon = step.icon;
          return (
            <div key={i} className={`step-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
              {isDone ? (
                <CheckCircle size={24} color="var(--success)" />
              ) : isActive ? (
                <div className="step-spinner" />
              ) : (
                <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border)' }} />
              )}
              <Icon size={18} color={isDone ? 'var(--success)' : isActive ? 'var(--accent-primary)' : 'var(--text-muted)'} />
              <span style={{ fontSize: 14, fontWeight: isDone || isActive ? 600 : 400 }}>
                {isDone ? step.doneLabel : step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Results */}
      {done && result && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Original ({result.detectedLang})</div>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>{result.original}</p>
          </div>
          <div className="card">
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Translated (English)</div>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>{result.translated}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Category</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{result.category}</div>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Routed To</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent-primary)' }}>{result.department}</div>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Urgency</div>
              <span className={`badge ${result.urgency === 'High' || result.urgency === 'Critical' ? 'error' : result.urgency === 'Medium' ? 'warning' : 'success'}`}>
                {result.urgency}
              </span>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Emotion</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{result.emotion}</div>
            </div>
          </div>

          {/* Matched Keywords — shows which admin sector keywords matched */}
          {result.matchedKeywords.length > 0 && (
            <div className="card" style={{ padding: 16, borderLeft: '3px solid var(--success)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700 }}>🧠 AI KEYWORD ROUTING</div>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                Matched <strong style={{ color: 'var(--accent-primary)' }}>{result.department}</strong> sector keywords:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.matchedKeywords.map((kw, i) => (
                  <span key={i} className="badge success" style={{ fontSize: 12 }}>🔑 {kw}</span>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Confidence: <strong>{result.confidence}%</strong> — This complaint will be forwarded to the <strong>{result.department}</strong> department
              </div>
            </div>
          )}

          {result.matchedKeywords.length === 0 && (
            <div className="card" style={{ padding: 16, borderLeft: '3px solid var(--warning)' }}>
              <div style={{ fontSize: 12, color: 'var(--warning)' }}>
                ⚠️ No sector keywords matched. Routed to <strong>General Administration</strong> as fallback.
              </div>
            </div>
          )}


          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button className="btn-primary" onClick={handleConfirm} style={{ flex: 1, justifyContent: 'center' }}>
              <span>✅ Confirm & Continue</span>
            </button>
            <button className="btn-secondary" onClick={() => router.back()} style={{ flex: 1, justifyContent: 'center' }}>
              ✏️ Edit
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

export default function ProcessingPage() {
  return (
    <NotificationProvider>
      <Suspense fallback={<div className="page-container" style={{ paddingTop: 80, textAlign: 'center' }}><div className="step-spinner" style={{ margin: '0 auto' }} /></div>}>
        <ProcessingFlow />
      </Suspense>
    </NotificationProvider>
  );
}
