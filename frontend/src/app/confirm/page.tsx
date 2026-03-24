'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MapPin, Navigation, CheckCircle, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { NotificationProvider } from '@/components/NotificationProvider';
import { db } from '../../../lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { auth } from '../../../lib/firebase';
import { sendComplaintEmail } from '@/lib/emailService';

function ConfirmFlow() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const original = searchParams.get('original') || '';
  const translated = searchParams.get('translated') || '';
  const category = searchParams.get('category') || '';
  const department = searchParams.get('department') || '';
  const departmentEmail = searchParams.get('departmentEmail') || '';
  const urgency = searchParams.get('urgency') || '';
  const emotion = searchParams.get('emotion') || '';
  const lang = searchParams.get('lang') || '';
  const matchedKeywords = searchParams.get('matchedKeywords') || '';
  const confidence = searchParams.get('confidence') || '';

  const [location, setLocation] = useState('');
  const [areaName, setAreaName] = useState('');
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [complaintId, setComplaintId] = useState('');
  const [imageData, setImageData] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);

  // Read image from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('complaintImage');
      if (stored) setImageData(stored);
    } catch { /* sessionStorage unavailable */ }
  }, []);

  // Auto-detect GPS on page load
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);

          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=14`);
            const data = await res.json();
            const addr = data.address || {};
            const area = addr.suburb || addr.village || addr.town || addr.city_district || addr.county || addr.city || 'Unknown Area';
            const city = addr.city || addr.state_district || addr.state || '';
            setAreaName(`${area}${city ? ', ' + city : ''}`);
          } catch {
            setAreaName('Location detected');
          }

          setGpsStatus('done');
        },
        () => {
          setGpsStatus('error');
        },
        { timeout: 15000, enableHighAccuracy: true }
      );
    } else {
      setGpsStatus('error');
    }
  }, []);

  const retryGPS = () => {
    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=14`);
          const data = await res.json();
          const addr = data.address || {};
          const area = addr.suburb || addr.village || addr.town || addr.city_district || addr.county || addr.city || 'Unknown Area';
          const city = addr.city || addr.state_district || addr.state || '';
          setAreaName(`${area}${city ? ', ' + city : ''}`);
        } catch {
          setAreaName('Location detected');
        }
        setGpsStatus('done');
      },
      () => {
        setGpsStatus('error');
      },
      { timeout: 15000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmissionError('');
    try {
      const user = auth.currentUser;

      if (!user) {
        setSubmissionError('You are not logged in. Please go back and sign in again.');
        setSubmitting(false);
        return;
      }

      const complaintData: Record<string, unknown> = {
        originalText: original,
        originalLanguage: lang,
        translatedText: translated,
        category,
        department,
        status: 'Pending',
        urgency,
        emotion,
        location: location || 'Not available',
        areaName: areaName || 'Unknown',
        createdAt: Timestamp.now(),
        userId: user.uid,
      };
      if (matchedKeywords) complaintData.matchedKeywords = matchedKeywords.split(',');
      if (confidence) complaintData.confidence = Number(confidence);
      // Save image data if available (store in Firestore — check size limits)
      if (imageData) {
        // Only store if under 900KB (Firestore doc limit is 1MB)
        if (imageData.length < 900000) {
          complaintData.imageData = imageData;
        }
      }

      const docRef = await addDoc(collection(db, 'complaints'), complaintData);
      setComplaintId(docRef.id);
      setSubmitting(false);
      setSubmitted(true);

      // Clean up sessionStorage
      try { sessionStorage.removeItem('complaintImage'); } catch { /* ignore */ }

      // Send complaint email via EmailJS (non-blocking)
      const currentUser = auth.currentUser;
      sendComplaintEmail({
        complaintId: docRef.id,
        originalText: original,
        translatedText: translated,
        category,
        department,
        departmentEmail,
        urgency,
        emotion,
        location: location || 'Not available',
        areaName: areaName || 'Unknown',
        userEmail: currentUser?.email || '',
        userName: currentUser?.displayName || '',
      }).then(sent => setEmailSent(sent)).catch(() => setEmailSent(false));
    } catch (err) {
      console.error('Submission failed:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      if (errorMsg.includes('permission') || errorMsg.includes('PERMISSION_DENIED')) {
        setSubmissionError('Permission denied. Please sign out and sign in again.');
      } else if (errorMsg.includes('network') || errorMsg.includes('unavailable')) {
        setSubmissionError('Network error. Please check your connection and try again.');
      } else {
        setSubmissionError('Failed to submit complaint. Please try again.');
      }
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="page-container" style={{ paddingTop: 0 }}>
        {/* Success Popup Overlay */}
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 20,
          animation: 'fadeIn 0.3s ease-out',
        }}>
          <div style={{
            background: 'var(--bg-card, #1a1a2e)', borderRadius: 24,
            padding: '40px 32px', maxWidth: 380, width: '100%',
            textAlign: 'center', position: 'relative', overflow: 'hidden',
            border: '1px solid rgba(76,175,80,0.3)',
            boxShadow: '0 24px 80px rgba(76,175,80,0.15), 0 0 60px rgba(76,175,80,0.08)',
            animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          }}>
            {/* Confetti-like particles */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              {[...Array(12)].map((_, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  width: 8, height: 8, borderRadius: '50%',
                  background: ['#4caf50', '#ffeb3b', '#2196f3', '#ff9800', '#e91e63', '#9c27b0'][i % 6],
                  top: `${10 + Math.random() * 30}%`,
                  left: `${10 + (i * 7)}%`,
                  opacity: 0.7,
                  animation: `confettiFall 2s ease-out ${i * 0.1}s infinite`,
                }} />
              ))}
            </div>

            {/* Animated Success Icon */}
            <div style={{
              width: 90, height: 90, borderRadius: '50%',
              background: 'linear-gradient(135deg, #4caf50, #66bb6a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', position: 'relative',
              animation: 'successPulse 2s ease-in-out infinite',
              boxShadow: '0 8px 32px rgba(76,175,80,0.4)',
            }}>
              <CheckCircle size={48} color="#fff" strokeWidth={2.5} />
            </div>

            {/* Title */}
            <h1 style={{
              fontSize: 26, fontWeight: 800, marginBottom: 8,
              background: 'linear-gradient(135deg, #4caf50, #81c784)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              Submitted Successfully!!
            </h1>

            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 4, lineHeight: 1.6 }}>
              Your complaint has been registered and forwarded.
            </p>
            <p style={{ color: 'var(--accent-primary)', fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
              📬 Forwarded to: {department}
              {emailSent === true && (
                <span style={{ display: 'block', color: '#4caf50', fontSize: 12, marginTop: 4 }}>✅ Email notification sent</span>
              )}
              {emailSent === false && (
                <span style={{ display: 'block', color: '#ffab40', fontSize: 12, marginTop: 4 }}>⚠️ Email notification failed — complaint is still saved</span>
              )}
            </p>

            {/* Complaint ID Badge */}
            <div style={{
              background: 'rgba(76,175,80,0.08)', padding: '14px 24px',
              borderRadius: 16, display: 'inline-block', marginBottom: 28,
              border: '1px solid rgba(76,175,80,0.2)',
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Complaint ID</span>
              <div style={{
                fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 22,
                color: '#4caf50', letterSpacing: 2,
              }}>
                {complaintId.slice(0, 8).toUpperCase()}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn-primary" onClick={() => router.push('/track')} style={{
                width: '100%', justifyContent: 'center', padding: '14px 24px',
                background: 'linear-gradient(135deg, #4caf50, #66bb6a)',
                borderRadius: 14, fontSize: 15, fontWeight: 700,
              }}>
                <span>📊 Track Complaint</span>
              </button>
              <button className="btn-secondary" onClick={() => router.push('/')} style={{
                width: '100%', justifyContent: 'center', padding: '14px 24px',
                borderRadius: 14, fontSize: 14,
              }}>
                🏠 Back to Home
              </button>
            </div>
          </div>
        </div>

        {/* CSS Animations */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes popIn {
            0% { transform: scale(0.5); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes successPulse {
            0%, 100% { transform: scale(1); box-shadow: 0 8px 32px rgba(76,175,80,0.4); }
            50% { transform: scale(1.05); box-shadow: 0 12px 48px rgba(76,175,80,0.6); }
          }
          @keyframes confettiFall {
            0% { transform: translateY(0) rotate(0deg); opacity: 0.7; }
            100% { transform: translateY(300px) rotate(720deg); opacity: 0; }
          }
        `}} />

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="page-container" style={{ paddingTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn-icon" onClick={() => router.back()}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Confirm & Submit</h1>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Original ({lang})</div>
          <p style={{ fontSize: 14 }}>{original}</p>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>English Translation</div>
          <p style={{ fontSize: 14 }}>{translated}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Category</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>{category}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Forwarded To</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4, color: 'var(--accent-primary)' }}>{department}</div>
          </div>
        </div>
      </div>

      {/* Attached Photo Preview */}
      {imageData && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ImageIcon size={16} color="var(--accent-primary)" />
            Attached Photo
          </h2>
          <div className="card" style={{ padding: 14 }}>
            <img
              src={imageData}
              alt="Complaint photo"
              style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 'var(--radius-md)', display: 'block', margin: '0 auto' }}
            />
          </div>
        </div>
      )}

      {/* Auto-detected Location */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📍 Your Location</h2>

        {gpsStatus === 'loading' && (
          <div className="card" style={{ padding: 20, textAlign: 'center' }}>
            <div className="step-spinner" style={{ margin: '0 auto 12px', width: 28, height: 28 }} />
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Detecting your GPS location...</p>
          </div>
        )}

        {gpsStatus === 'done' && (
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={18} color="var(--success)" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--success)' }}>{areaName || 'Location Detected'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{location}</div>
              </div>
            </div>
          </div>
        )}

        {gpsStatus === 'error' && (
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--warning-bg, rgba(255,171,64,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={18} color="var(--warning)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--warning)' }}>GPS unavailable</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Complaint will still be processed</div>
              </div>
              <button onClick={retryGPS} className="btn-secondary" style={{ padding: '6px 14px', fontSize: 12 }}>
                <Navigation size={14} />
                <span>Retry</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Submission Error */}
      {submissionError && (
        <div style={{ background: 'var(--error-bg, rgba(255,82,82,0.1))', border: '1px solid rgba(255,82,82,0.3)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 12, fontSize: 13, color: 'var(--error)', fontWeight: 600 }}>
          ⚠️ {submissionError}
        </div>
      )}

      {/* Submit */}
      <button className="btn-primary" onClick={handleSubmit} disabled={submitting || gpsStatus === 'loading'} style={{ width: '100%', justifyContent: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {submitting ? <div className="step-spinner" style={{ width: 18, height: 18 }} /> : '✅'}
          {submitting ? 'Submitting...' : submissionError ? 'Retry Submission' : 'Confirm & Submit'}
        </span>
      </button>

      <BottomNav />
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <NotificationProvider>
      <Suspense fallback={<div className="page-container" style={{ paddingTop: 40, textAlign: 'center' }}><div className="step-spinner" style={{ margin: '0 auto' }} /></div>}>
        <ConfirmFlow />
      </Suspense>
    </NotificationProvider>
  );
}
