'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Mic, PenLine, MapPin, AlertTriangle, ChevronDown, Shield, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { NotificationProvider } from '@/components/NotificationProvider';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const SatelliteMap = dynamic(() => import('@/components/SatelliteMap'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: 200, borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
      <div className="step-spinner" style={{ width: 24, height: 24 }} />
    </div>
  ),
});

const languages = [
  { code: 'auto', label: '🌐 Auto Detect' },
  { code: 'te', label: '🇮🇳 తెలుగు (Telugu)' },
  { code: 'en', label: '🇬🇧 English' },
  { code: 'hi', label: '🇮🇳 हिंदी (Hindi)' },
  { code: 'ta', label: '🇮🇳 தமிழ் (Tamil)' },
  { code: 'ml', label: '🇮🇳 മലയാളം (Malayalam)' },
  { code: 'kn', label: '🇮🇳 ಕನ್ನಡ (Kannada)' },
];

export default function HomePage() {
  const router = useRouter();
  const [language, setLanguage] = useState('auto');
  const [userName, setUserName] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      // Set user info immediately — don't wait for Firestore
      setUserName(user.displayName || user.email?.split('@')[0] || 'User');
      setIsAuthenticated(true);
      setAuthLoading(false);

      // Check admin role in background — redirect admins to admin dashboard
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          router.replace('/admin');
          return;
        }
      } catch {
        // Firestore check failed — allow through
      }
    });
    return () => unsub();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="step-spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <NotificationProvider>
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16 }}>

        {/* Sign Out Header — always visible when authenticated */}
        {isAuthenticated && (
          <div className="fade-in" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              👋 Hi, <strong style={{ color: 'var(--text-primary)' }}>{userName || 'User'}</strong>
            </span>
            <button
              onClick={handleSignOut}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,82,82,0.08)', border: '1px solid rgba(255,82,82,0.2)',
                borderRadius: 'var(--radius-full)', padding: '6px 14px',
                color: 'var(--error)', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-body)',
                transition: 'all 0.2s ease',
              }}
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        )}

        {/* Header */}
        <div className="fade-in" style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
            <Shield size={32} color="var(--accent-primary)" />
            <h1 style={{ fontSize: 28, fontWeight: 800, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              SAARTHI AI
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 300, margin: '0 auto' }}>
            Multilingual AI Grievance Portal — Your voice, any language
          </p>
        </div>

        {/* Satellite Map */}
        <div className="fade-in" style={{ width: '100%', maxWidth: 340, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={14} color="var(--accent-primary)" />
            Your Area
          </div>
          <SatelliteMap />
        </div>

        {/* Language Selector */}
        <div className="fade-in" style={{ marginBottom: 32, width: '100%', maxWidth: 280 }}>
          <select
            className="select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{ width: '100%' }}
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* Main Actions */}
        <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 340, marginBottom: 40 }}>
          <Link href={`/complaint?mode=voice&lang=${language}`} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Mic size={24} color="#fff" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Speak Complaint</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Use voice in any language</div>
              </div>
            </div>
          </Link>

          <Link href={`/complaint?mode=text&lang=${language}`} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #7b2ff7, #b388ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <PenLine size={24} color="#fff" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Type Complaint</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Describe your issue in text</div>
              </div>
            </div>
          </Link>
        </div>

        {/* SOS Quick Action */}
        <div className="slide-up" style={{ width: '100%', maxWidth: 340, marginBottom: 40 }}>
          <Link href="/complaint?mode=voice&lang=auto&sos=true" style={{ textDecoration: 'none' }}>
            <div className="sos-button" style={{ flexDirection: 'column', padding: 18, borderRadius: 'var(--radius-lg)', alignItems: 'center', justifyContent: 'center', width: '100%', gap: 6 }}>
              <AlertTriangle size={26} />
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>SOS EMERGENCY</div>
            </div>
          </Link>
        </div>

        {/* Floating mic */}
        <Link href={`/complaint?mode=voice&lang=${language}`}>
          <button className="mic-button" style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 99 }}>
            <Mic size={32} color="#fff" />
          </button>
        </Link>

        <BottomNav />
      </div>
    </NotificationProvider>
  );
}
