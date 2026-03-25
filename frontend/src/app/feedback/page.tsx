'use client';

import { useState } from 'react';
import { ArrowLeft, Send, Star, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { NotificationProvider, useNotification } from '@/components/NotificationProvider';
import NavyFluidBackground from '@/components/NavyFluidBackground';
import { auth } from '../../../lib/firebase';

function FeedbackForm() {
  const router = useRouter();
  const { showNotification } = useNotification();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [sent, setSent] = useState(false);

  const handleSubmit = () => {
    if (!message.trim()) {
      showNotification('warning', 'Empty Feedback', 'Please write your feedback before sending.');
      return;
    }

    const userEmail = auth.currentUser?.email || 'Anonymous';
    const ratingText = rating > 0 ? `\n\nRating: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} (${rating}/5)` : '';
    const fullBody = `${message}${ratingText}\n\n---\nSent by: ${userEmail}\nSent from: PolyListen App`;
    const subjectLine = subject.trim() || 'App Feedback';

    // Open email client with pre-filled details
    const mailtoLink = `mailto:squardsummit@gmail.com?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(fullBody)}`;
    window.open(mailtoLink, '_blank');

    setSent(true);
    showNotification('success', 'Feedback Ready', 'Your email client has been opened with the feedback.');
  };

  if (sent) {
    return (
      <div className="page-container" style={{ paddingTop: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', gap: 16 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #00c853, #69f0ae)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'pulse 2s ease-in-out infinite',
          }}>
            <CheckCircle size={40} color="#fff" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>Thank You!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 280 }}>
            Your feedback email has been prepared. Please send it from your email client.
          </p>
          <button className="btn-primary" onClick={() => { setSent(false); setSubject(''); setMessage(''); setRating(0); }} style={{ marginTop: 16 }}>
            Send Another Feedback
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="page-container" style={{ paddingTop: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn-icon" onClick={() => router.back()}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>💬 Feedback</h1>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
        Share your experience, suggestions, or report issues. Your feedback will be emailed directly to our team.
      </p>

      {/* Rating */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, display: 'block', textTransform: 'uppercase', letterSpacing: 1 }}>
          ⭐ Rate your experience
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                transition: 'transform 0.15s',
                transform: (hoverRating || rating) >= star ? 'scale(1.2)' : 'scale(1)',
              }}
            >
              <Star
                size={32}
                color={(hoverRating || rating) >= star ? '#ffc107' : 'var(--border)'}
                fill={(hoverRating || rating) >= star ? '#ffc107' : 'none'}
              />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            {rating <= 2 ? "We'll work to improve!" : rating <= 3 ? 'Thanks for the feedback!' : 'Glad you enjoy it! 🎉'}
          </p>
        )}
      </div>

      {/* Subject */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: 1 }}>
          📌 Subject (optional)
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Feature request, Bug report..."
          style={{
            width: '100%', padding: '12px 16px',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
            fontSize: 15, outline: 'none', transition: 'border-color 0.2s',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />
      </div>

      {/* Message */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: 1 }}>
          ✍️ Your feedback
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us what you think — suggestions, issues, compliments..."
          style={{
            width: '100%', minHeight: 140, padding: '14px 16px',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
            fontSize: 15, lineHeight: 1.7, resize: 'vertical',
            fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.2s',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />
      </div>

      {/* Send */}
      <button className="btn-primary" onClick={handleSubmit} style={{ width: '100%', justifyContent: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Send size={18} />
          Send Feedback
        </span>
      </button>

      <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
        📧 Feedback will be sent to squardsummit@gmail.com
      </p>

      <BottomNav />
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <NotificationProvider>
      <NavyFluidBackground />
      <FeedbackForm />
    </NotificationProvider>
  );
}
