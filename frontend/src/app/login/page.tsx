'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../../lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const ADMIN_ACCESS_CODE = 'SAARTHI@2026';

type FormMode = 'login' | 'register' | 'admin';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<FormMode>('login');

  // User form state
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userConfirmPassword, setUserConfirmPassword] = useState('');

  // Admin form state
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminCode, setAdminCode] = useState('');

  // Shared
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [showResend, setShowResend] = useState(false);

  // ─── User Sign In ───
  const handleUserSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, userEmail, userPassword);
      // Check email verification
      if (!cred.user.emailVerified) {
        await signOut(auth);
        setError('Please verify your email before signing in. Check your inbox for the verification link.');
        setShowResend(true);
        setLoading(false);
        return;
      }
      setShowResend(false);
      router.push('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim());
    }
    setLoading(false);
  };

  const handleResendVerification = async () => {
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, userEmail, userPassword);
      await sendEmailVerification(cred.user);
      setVerificationSent(true);
      setVerificationEmail(userEmail);
      await signOut(auth);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send verification email';
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim());
    }
    setLoading(false);
  };

  // ─── User Sign Up ───
  const handleUserSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (userPassword !== userConfirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (userPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, userEmail, userPassword);
      if (userName) {
        await updateProfile(cred.user, { displayName: userName });
      }
      await setDoc(doc(db, 'users', cred.user.uid), {
        role: 'user',
        email: userEmail,
        displayName: userName || '',
        createdAt: new Date().toISOString(),
      });

      // Send verification email
      await sendEmailVerification(cred.user);
      setVerificationSent(true);
      setVerificationEmail(userEmail);
      // Sign out until verified
      await signOut(auth);
    } catch (err: unknown) {
      let friendlyMsg = 'Sign up failed. Please try again.';
      if (err instanceof Error) {
        const code = (err as { code?: string }).code || '';
        if (code === 'auth/email-already-in-use') {
          friendlyMsg = 'This email is already registered. Try signing in instead.';
        } else if (code === 'auth/invalid-email') {
          friendlyMsg = 'Please enter a valid email address.';
        } else if (code === 'auth/weak-password') {
          friendlyMsg = 'Password is too weak. Use at least 6 characters.';
        } else if (code === 'auth/network-request-failed') {
          friendlyMsg = 'Network error. Check your internet connection.';
        } else if (code === 'auth/too-many-requests') {
          friendlyMsg = 'Too many attempts. Please wait a moment and try again.';
        } else if (code === 'auth/operation-not-allowed') {
          friendlyMsg = 'Email/Password sign-up is not enabled. Contact admin.';
        } else {
          friendlyMsg = err.message.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim() || friendlyMsg;
        }
      }
      setError(friendlyMsg);
    }
    setLoading(false);
  };

  // ─── Admin Sign In ───
  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (adminCode.trim() !== ADMIN_ACCESS_CODE) {
      setError('Invalid access code. Contact the system administrator.');
      return;
    }

    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

      const roleCheckResult = await Promise.race([
        getDoc(doc(db, 'users', cred.user.uid))
          .then((d) => d.exists() && d.data().role === 'user' ? 'blocked' : 'ok')
          .catch(() => 'ok'),
        new Promise<string>((r) => setTimeout(() => r('timeout'), 200)),
      ]);

      if (roleCheckResult === 'blocked') {
        await signOut(auth);
        setError('You do not have admin privileges.');
        setLoading(false);
        return;
      }

      try { sessionStorage.setItem('isAdminSession', 'true'); } catch { /* ignore */ }
      router.push('/admin');

      const uid = cred.user.uid;
      setDoc(doc(db, 'users', uid), {
        role: 'admin',
        email: adminEmail,
        createdAt: new Date().toISOString(),
      }, { merge: true }).catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Admin login failed';
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim());
    }
    setLoading(false);
  };

  // ─── Verification Email Sent Screen ───
  if (verificationSent) {
    return (
      <div className="gl-page">
      <div className="gl-bg">
          <div className="gl-blob gl-blob-1" />
          <div className="gl-blob gl-blob-2" />
          <div className="gl-blob gl-blob-3" />
          <div className="gl-blob gl-blob-4" />
        </div>
        <div className="gl-brand-watermark">SAARTHI AI</div>
        <div className="gl-wrapper">
          <div className="gl-border-glow" />
          <div className="gl-card" style={{ textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(135deg, #4caf50, #66bb6a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 32,
            }}>
              ✉️
            </div>
            <h2 className="gl-title" style={{ fontSize: 22 }}>Verify Your Email</h2>
            <p className="gl-subtitle" style={{ marginTop: 8, lineHeight: 1.6 }}>
              We&apos;ve sent a verification link to<br />
              <strong style={{ color: '#00d2ff' }}>{verificationEmail}</strong>
            </p>
            <p style={{ color: 'rgba(200,200,255,0.4)', fontSize: 13, marginTop: 16 }}>
              Please check your inbox (and spam folder) and click the link to verify your account.
            </p>
            <button
              className="gl-submit"
              style={{ marginTop: 24 }}
              onClick={() => { setVerificationSent(false); setMode('login'); setError(''); }}
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gl-page">
      {/* Animated gradient background blobs */}
      <div className="gl-bg">
        <div className="gl-blob gl-blob-1" />
        <div className="gl-blob gl-blob-2" />
        <div className="gl-blob gl-blob-3" />
        <div className="gl-blob gl-blob-4" />
      </div>

      {/* SAARTHI AI brand watermark */}
      <div className="gl-brand-watermark">SAARTHI AI</div>

      {/* Glass card with rotating border */}
      <div className={`gl-wrapper ${mode === 'register' ? 'gl-wrapper-expanded' : ''} ${mode === 'admin' ? 'gl-wrapper-admin' : ''}`}>
        {/* Spinning border */}
        <div className="gl-border-glow" />

        <div className="gl-card">
          {/* Header */}
          <div className="gl-header">
            <h1 className="gl-title">
              {mode === 'admin' ? 'Command Center' : mode === 'register' ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="gl-subtitle">
              {mode === 'admin' ? 'Authorized Personnel Only' : mode === 'register' ? 'Join Saarthi AI today' : 'Sign in to Saarthi AI'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="gl-error">{error}</div>
          )}

          {/* ── LOGIN FORM ── */}
          {mode === 'login' && (
            <form onSubmit={handleUserSignIn} className="gl-form">
              <div className="gl-input-group">
                <input
                  type="email"
                  className="gl-input"
                  placeholder=" "
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  required
                  id="login-email"
                />
                <label htmlFor="login-email" className="gl-label">Email</label>
                <span className="gl-input-line" />
              </div>
              <div className="gl-input-group">
                <input
                  type="password"
                  className="gl-input"
                  placeholder=" "
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  required
                  id="login-password"
                />
                <label htmlFor="login-password" className="gl-label">Password</label>
                <span className="gl-input-line" />
              </div>
              <button type="submit" className="gl-submit" disabled={loading}>
                {loading ? <span className="gl-spinner" /> : 'Sign In'}
              </button>
              
              {showResend && (
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                  <button 
                    type="button" 
                    className="gl-submit" 
                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)' }}
                    onClick={handleResendVerification}
                    disabled={loading}
                  >
                    Resend Verification Email
                  </button>
                </div>
              )}
            </form>
          )}

          {/* ── REGISTER FORM ── */}
          {mode === 'register' && (
            <form onSubmit={handleUserSignUp} className="gl-form">
              <div className="gl-input-group">
                <input
                  type="text"
                  className="gl-input"
                  placeholder=" "
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                  id="reg-name"
                />
                <label htmlFor="reg-name" className="gl-label">Full Name</label>
                <span className="gl-input-line" />
              </div>
              <div className="gl-input-group">
                <input
                  type="email"
                  className="gl-input"
                  placeholder=" "
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  required
                  id="reg-email"
                />
                <label htmlFor="reg-email" className="gl-label">Email</label>
                <span className="gl-input-line" />
              </div>
              <div className="gl-input-group">
                <input
                  type="password"
                  className="gl-input"
                  placeholder=" "
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  required
                  id="reg-password"
                />
                <label htmlFor="reg-password" className="gl-label">Password</label>
                <span className="gl-input-line" />
              </div>
              <div className="gl-input-group">
                <input
                  type="password"
                  className="gl-input"
                  placeholder=" "
                  value={userConfirmPassword}
                  onChange={(e) => setUserConfirmPassword(e.target.value)}
                  required
                  id="reg-confirm"
                />
                <label htmlFor="reg-confirm" className="gl-label">Confirm Password</label>
                <span className="gl-input-line" />
              </div>
              <button type="submit" className="gl-submit" disabled={loading}>
                {loading ? <span className="gl-spinner" /> : 'Create Account'}
              </button>
            </form>
          )}

          {/* ── ADMIN FORM ── */}
          {mode === 'admin' && (
            <form onSubmit={handleAdminSignIn} className="gl-form">
              <div className="gl-input-group">
                <input
                  type="email"
                  className="gl-input"
                  placeholder=" "
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                  id="admin-email"
                />
                <label htmlFor="admin-email" className="gl-label">Admin Email</label>
                <span className="gl-input-line" />
              </div>
              <div className="gl-input-group">
                <input
                  type="password"
                  className="gl-input"
                  placeholder=" "
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  id="admin-password"
                />
                <label htmlFor="admin-password" className="gl-label">Password</label>
                <span className="gl-input-line" />
              </div>
              <div className="gl-input-group">
                <input
                  type="password"
                  className="gl-input"
                  placeholder=" "
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  required
                  id="admin-code"
                />
                <label htmlFor="admin-code" className="gl-label">Access Code</label>
                <span className="gl-input-line" />
              </div>
              <button type="submit" className="gl-submit gl-submit-admin" disabled={loading}>
                {loading ? <span className="gl-spinner" /> : 'Enter Command Center'}
              </button>
            </form>
          )}

          {/* Toggle links */}
          <div className="gl-toggle-links">
            {mode === 'login' && (
              <>
                <p className="gl-toggle-text">
                  Don&apos;t have an account?{' '}
                  <button className="gl-toggle-btn" onClick={() => { setMode('register'); setError(''); setShowResend(false); }}>
                    Register
                  </button>
                </p>
                <button className="gl-toggle-btn gl-admin-link" onClick={() => { setMode('admin'); setError(''); setShowResend(false); }}>
                  Admin Login
                </button>
              </>
            )}
            {mode === 'register' && (
              <p className="gl-toggle-text">
                Already have an account?{' '}
                <button className="gl-toggle-btn" onClick={() => { setMode('login'); setError(''); setShowResend(false); }}>
                  Sign In
                </button>
              </p>
            )}
            {mode === 'admin' && (
              <p className="gl-toggle-text">
                <button className="gl-toggle-btn" onClick={() => { setMode('login'); setError(''); setShowResend(false); }}>
                  ← Back to User Login
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
