'use client';

import { useState, useRef, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Mic, MicOff, Send, ArrowLeft, Camera, X, Loader2 } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { NotificationProvider, useNotification } from '@/components/NotificationProvider';

// ── Language Config ───────────────────────────────────────────
const LANG_OPTIONS = [
  { code: 'auto', label: 'Auto Detect', sarvamCode: 'unknown' },
  { code: 'te', label: 'Telugu', sarvamCode: 'te-IN' },
  { code: 'hi', label: 'Hindi', sarvamCode: 'hi-IN' },
  { code: 'en', label: 'English', sarvamCode: 'en-IN' },
  { code: 'ta', label: 'Tamil', sarvamCode: 'ta-IN' },
  { code: 'ml', label: 'Malayalam', sarvamCode: 'ml-IN' },
  { code: 'kn', label: 'Kannada', sarvamCode: 'kn-IN' },
  { code: 'bn', label: 'Bengali', sarvamCode: 'bn-IN' },
  { code: 'mr', label: 'Marathi', sarvamCode: 'mr-IN' },
  { code: 'gu', label: 'Gujarati', sarvamCode: 'gu-IN' },
  { code: 'pa', label: 'Punjabi', sarvamCode: 'pa-IN' },
  { code: 'or', label: 'Odia', sarvamCode: 'od-IN' },
];

const LANG_NAMES: Record<string, string> = {};
LANG_OPTIONS.forEach(l => { LANG_NAMES[l.code] = l.label; LANG_NAMES[l.sarvamCode] = l.label; });

// Map Sarvam language codes back to short codes
const SARVAM_TO_SHORT: Record<string, string> = {};
LANG_OPTIONS.forEach(l => { SARVAM_TO_SHORT[l.sarvamCode] = l.code; });

// ── Main Component ───────────────────────────────────────────
function ComplaintForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showNotification } = useNotification();
  const mode = searchParams.get('mode') || 'text';
  const lang = searchParams.get('lang') || 'auto';
  const isSos = searchParams.get('sos') === 'true';

  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [translation, setTranslation] = useState('');
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [image, setImage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectedLangRef = useRef<string | null>(null);

  // ── Format recording time ──
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Convert any audio blob to WAV (16kHz mono) for Sarvam AI ──
  const convertBlobToWav = async (blob: Blob): Promise<Blob> => {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Get mono channel data (mix down if stereo)
    const numberOfChannels = 1;
    const sampleRate = 16000;
    // Resample to 16kHz
    const offlineCtx = new OfflineAudioContext(numberOfChannels, audioBuffer.duration * sampleRate, sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    const renderedBuffer = await offlineCtx.startRendering();

    const pcmData = renderedBuffer.getChannelData(0);
    const wavBuffer = encodeWav(pcmData, sampleRate);
    await audioContext.close();
    return new Blob([wavBuffer], { type: 'audio/wav' });
  };

  // ── Encode PCM float32 data into WAV format ──
  const encodeWav = (samples: Float32Array, sampleRate: number): ArrayBuffer => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);           // chunk size
    view.setUint16(20, 1, true);            // PCM format
    view.setUint16(22, 1, true);            // mono
    view.setUint32(24, sampleRate, true);   // sample rate
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true);            // block align
    view.setUint16(34, 16, true);           // bits per sample
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Convert float32 to int16
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  };

  // ── Send audio to Sarvam AI (v3 — saaras:v3 model) ──
  const processAudioWithSarvam = useCallback(async (audioBlob: Blob) => {
    setIsProcessing(true);

    try {
      // Get the Sarvam language code for the selected language
      const langOption = LANG_OPTIONS.find(l => l.code === lang);
      const sarvamLangCode = langOption?.sarvamCode || 'unknown';

      // Convert recorded audio (webm/opus) to WAV format for Sarvam AI
      const wavBlob = await convertBlobToWav(audioBlob);

      const formData = new FormData();
      formData.append('file', wavBlob, 'recording.wav');
      formData.append('model', 'saaras:v3');
      formData.append('language_code', sarvamLangCode);
      formData.append('with_timestamps', 'true');

      // Call Sarvam AI v3 speech-to-text endpoint
      const apiKey = process.env.NEXT_PUBLIC_SARVAM_API_KEY || '';

      // First: get the transcription
      const transcriptResponse = await fetch('https://api.sarvam.ai/speech-to-text', {
        method: 'POST',
        headers: {
          'api-subscription-key': apiKey,
        },
        body: formData,
      });

      if (!transcriptResponse.ok) {
        const errText = await transcriptResponse.text();
        console.error('[Sarvam AI] Transcript Error:', transcriptResponse.status, errText);
        throw new Error(`Sarvam AI error (${transcriptResponse.status}): ${errText.substring(0, 120)}`);
      }

      const contentType = transcriptResponse.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new Error('Received HTML instead of JSON. Please Hard Refresh (Ctrl+Shift+R).');
      }

      const transcriptResult = await transcriptResponse.json();
      const nativeTranscript = transcriptResult.transcript || '';
      const detectedLanguageCode = transcriptResult.language_code || sarvamLangCode;

      // Second: get translation to English (separate call with mode=translate)
      let englishTranslation = '';
      if (nativeTranscript && detectedLanguageCode !== 'en-IN') {
        const translateFormData = new FormData();
        translateFormData.append('file', wavBlob, 'recording.wav');
        translateFormData.append('model', 'saaras:v3');
        translateFormData.append('language_code', detectedLanguageCode !== 'unknown' ? detectedLanguageCode : sarvamLangCode);
        translateFormData.append('mode', 'translate');

        const translateResponse = await fetch('https://api.sarvam.ai/speech-to-text', {
          method: 'POST',
          headers: {
            'api-subscription-key': apiKey,
          },
          body: translateFormData,
        });

        if (translateResponse.ok) {
          const translateContentType = translateResponse.headers.get('content-type');
          if (!translateContentType || !translateContentType.includes('text/html')) {
            const translateResult = await translateResponse.json();
            englishTranslation = translateResult.transcript || '';
          }
        }
      } else if (detectedLanguageCode === 'en-IN') {
        // Already English, use transcript as translation
        englishTranslation = nativeTranscript;
      }

      // Map the detected language code to a display name
      const shortCode = SARVAM_TO_SHORT[detectedLanguageCode] || detectedLanguageCode;
      const displayName = LANG_NAMES[shortCode] || LANG_NAMES[detectedLanguageCode] || detectedLanguageCode;

      setTranscription(nativeTranscript);
      setTranslation(englishTranslation);
      setDetectedLang(displayName);
      detectedLangRef.current = shortCode;

      // Set the text field to native transcript for submission
      setText(nativeTranscript);

      if (nativeTranscript) {
        showNotification('success', 'Transcription Complete', `Detected: ${displayName}`);
      } else {
        showNotification('warning', 'No Speech Detected', 'Could not recognize any speech in the recording.');
      }
    } catch (error) {
      console.error('[Sarvam AI] Error:', error);
      showNotification('error', 'Transcription Failed', error instanceof Error ? error.message : 'Could not process audio.');
    } finally {
      setIsProcessing(false);
    }
  }, [lang, showNotification]);

  // ── Start Recording ────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      // Use WAV-compatible format if available, fallback to webm
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        // Process with Sarvam AI
        processAudioWithSarvam(audioBlob);
      };

      // Start recording with 250ms chunks for responsiveness
      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingTime(0);
      setTranscription('');
      setTranslation('');
      setDetectedLang(null);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Microphone access error:', error);
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        showNotification('error', 'Permission Denied', 'Please allow microphone access to record.');
      } else {
        showNotification('error', 'Microphone Error', 'Could not access your microphone.');
      }
    }
  };

  // ── Stop Recording ─────────────────────────────────────────
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  };

  // ── Image Upload ───────────────────────────────────────────
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!text.trim() && !transcription.trim()) {
      showNotification('warning', 'Empty Complaint', 'Please describe your issue first.');
      return;
    }
    // Store image in sessionStorage (too large for URL params)
    if (image) {
      try { sessionStorage.setItem('complaintImage', image); } catch { /* quota exceeded — skip image */ }
    } else {
      sessionStorage.removeItem('complaintImage');
    }
    const complaintText = text || transcription;
    const encoded = encodeURIComponent(complaintText);
    const detLang = detectedLang ? `&detectedLang=${encodeURIComponent(detectedLang)}` : '';
    const srcLang = detectedLangRef.current ? `&srcLang=${detectedLangRef.current}` : '';
    // Pass Sarvam translation if available
    const translationParam = translation ? `&sarvamTranslation=${encodeURIComponent(translation)}` : '';
    router.push(`/processing?text=${encoded}&lang=${lang}&sos=${isSos}${detLang}${srcLang}${translationParam}`);
  };

  // Waveform bars for recording animation
  const waveformBars = Array.from({ length: 20 }, (_, i) => (
    <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.05}s` }} />
  ));

  return (
    <div className="page-container" style={{ paddingTop: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn-icon" onClick={() => router.back()}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>
          {isSos && '🚨 '}
          {mode === 'voice' ? 'Voice Complaint' : 'Type Complaint'}
        </h1>
      </div>

      {isSos && (
        <div style={{ background: 'var(--error-bg)', border: '1px solid rgba(255,82,82,0.3)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--error)', fontWeight: 600 }}>
          🚨 EMERGENCY MODE — This complaint will be flagged as highest priority.
        </div>
      )}

      {/* Voice Mode */}
      {mode === 'voice' && (
        <div className="fade-in" style={{ textAlign: 'center', marginBottom: 32 }}>
          {/* Recording waveform */}
          {isRecording && (
            <div className="waveform-container" style={{ marginBottom: 20 }}>
              {waveformBars}
            </div>
          )}

          {/* Recording timer */}
          {isRecording && (
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--error)', marginBottom: 12, fontFamily: 'monospace' }}>
              🔴 {formatTime(recordingTime)}
            </div>
          )}

          {/* Processing spinner */}
          {isProcessing && (
            <div style={{ marginBottom: 20 }}>
              <Loader2 size={40} color="var(--accent-primary)" className="spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--accent-primary)', fontSize: 14, fontWeight: 600 }}>
                🧠 AI Processing... Transcribing & Translating
              </p>
            </div>
          )}

          {/* Mic button */}
          <button
            className={`mic-button ${isRecording ? 'recording' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            style={{ margin: '0 auto 16px', opacity: isProcessing ? 0.5 : 1 }}
          >
            {isRecording ? <MicOff size={32} color="#fff" /> : <Mic size={32} color="#fff" />}
          </button>

          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {isProcessing
              ? 'Processing your recording...'
              : isRecording
                ? 'Recording... Tap to stop'
                : 'Tap microphone to start speaking'}
          </p>

          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
            🌐 Powered by Sarvam AI — Supports all 22 Indian languages
          </p>

          {/* Native Script Transcription */}
          {transcription && (
            <div className="card" style={{ marginTop: 20, textAlign: 'left' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                📝 Native Transcription
                {detectedLang && (
                  <span style={{ marginLeft: 8, color: 'var(--accent-primary)', textTransform: 'none', fontWeight: 500 }}>
                    ({detectedLang})
                  </span>
                )}
              </div>
              <p style={{ fontSize: 16, lineHeight: 1.8, wordBreak: 'break-word' }}>
                {transcription}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Text Mode */}
      {mode === 'text' && (
        <div className="fade-in" style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: 1 }}>
              📝 Describe your complaint
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your complaint in detail here... You can write in any language."
              style={{
                width: '100%', minHeight: 160, padding: '14px 16px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                fontSize: 15, lineHeight: 1.7, resize: 'vertical',
                fontFamily: 'var(--font-body)', outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              🌐 Supports all languages — AI will auto-detect and translate
            </p>
          </div>
        </div>
      )}

      {/* Camera Capture */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14 }}>
          <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} style={{ display: 'none' }} />
          <div className="btn-icon" style={{ width: 40, height: 40 }}>
            <Camera size={18} />
          </div>
          <span>📸 Take a photo</span>
        </label>
        {image && (
          <div style={{ position: 'relative', marginTop: 12, display: 'inline-block' }}>
            <img src={image} alt="Captured" style={{ maxWidth: 200, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }} />
            <button onClick={() => setImage(null)} style={{ position: 'absolute', top: -8, right: -8, background: 'var(--error)', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={12} color="#fff" />
            </button>
          </div>
        )}
      </div>

      {/* Submit */}
      <button className="btn-primary" onClick={handleSubmit} disabled={isProcessing} style={{ width: '100%', justifyContent: 'center', opacity: isProcessing ? 0.5 : 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Send size={18} />
          Process with AI
        </span>
      </button>

      <BottomNav />
    </div>
  );
}

export default function ComplaintPage() {
  return (
    <NotificationProvider>
      <Suspense fallback={<div className="page-container" style={{ paddingTop: 40, textAlign: 'center' }}><div className="step-spinner" style={{ margin: '0 auto' }} /></div>}>
        <ComplaintForm />
      </Suspense>
    </NotificationProvider>
  );
}
