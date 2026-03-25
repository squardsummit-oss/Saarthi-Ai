'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Filter, RefreshCw } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { NotificationProvider, useNotification } from '@/components/NotificationProvider';
import NavyFluidBackground from '@/components/NavyFluidBackground';
import { db, auth } from '../../../lib/firebase';
import { collection, query, onSnapshot, where, limit } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

interface Complaint {
  id: string;
  originalText: string;
  translatedText: string;
  category: string;
  department: string;
  status: string;
  urgency: string;
  location: string;
  createdAt: { seconds: number };
}

const statusColors: Record<string, string> = {
  'Submitted': 'var(--info)',
  'Pending': 'var(--warning)',
  'In Progress': 'var(--accent-primary)',
  'Resolved': 'var(--success)',
};

const statusSteps = ['Pending', 'In Progress', 'Resolved'];

function TrackingDashboard() {
  const router = useRouter();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  const handleRefresh = () => {
    setLoading(true);
    setComplaints([]);
    setRefreshKey(k => k + 1);
  };

  // Auth listener — get current user's uid
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        router.push('/login');
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    let unsubscribed = false;
    
    // Query only this user's complaints using where clause
    // This satisfies Firestore security rules which require userId match
    const q = query(
      collection(db, 'complaints'),
      where('userId', '==', userId),
      limit(500)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      if (unsubscribed) return;
      const data: Complaint[] = [];
      snapshot.forEach((d) => {
        const item = { id: d.id, ...d.data() } as Complaint;
        data.push(item);
      });
      // Sort client-side by createdAt descending
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setComplaints(data);
      setLoading(false);
    }, (error) => {
      console.error('Track page fetch error:', error);
      setLoading(false);
    });

    return () => { unsubscribed = true; unsub(); };
  }, [refreshKey, userId]);

  const filtered = complaints.filter((c) => {
    if (filter === 'active') return c.status !== 'Resolved';
    if (filter === 'resolved') return c.status === 'Resolved';
    return true;
  });

  const formatDate = (ts: { seconds: number }) => {
    return new Date(ts.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="page-container" style={{ paddingTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn-icon" onClick={() => router.push('/')}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, flex: 1 }}>Track Complaints</h1>
        <button className="btn-icon" onClick={handleRefresh}>
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['all', 'active', 'resolved'] as const).map((f) => (
          <button
            key={f}
            className={filter === f ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setFilter(f)}
            style={{ padding: '8px 16px', fontSize: 13, borderRadius: 'var(--radius-full)' }}
          >
            <span>{f.charAt(0).toUpperCase() + f.slice(1)}</span>
          </button>
        ))}
      </div>

      {/* Complaints List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 86 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <Clock size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p>No complaints found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((c) => (
            <div
              key={c.id}
              className="card"
              style={{ cursor: 'pointer', padding: 16 }}
              onClick={() => setSelected(selected?.id === c.id ? null : c)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                  #{c.id.slice(0, 8).toUpperCase()}
                </span>
                <span className={`badge ${c.status === 'Resolved' ? 'success' : c.status === 'In Progress' ? 'warning' : 'error'}`}>
                  <span className={`status-dot ${c.status.toLowerCase().replace(' ', '-')}`} />
                  {c.status}
                </span>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.translatedText || c.originalText}
              </p>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>{c.category}</span>
                <span>•</span>
                <span>{c.location}</span>
              </div>

              {/* Expanded Timeline */}
              {selected?.id === c.id && (
                <div className="fade-in" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>TIMELINE</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {statusSteps.map((step, i) => {
                      const currentIdx = statusSteps.indexOf(c.status);
                      const isDone = i <= currentIdx;
                      return (
                        <div key={step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: isDone ? statusColors[step] : 'var(--bg-secondary)', border: `2px solid ${isDone ? statusColors[step] : 'var(--border)'}` }} />
                            {i < statusSteps.length - 1 && <div style={{ width: 2, height: 24, background: isDone && i < currentIdx ? statusColors[step] : 'var(--border)' }} />}
                          </div>
                          <div style={{ paddingBottom: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: isDone ? 600 : 400, color: isDone ? 'var(--text-primary)' : 'var(--text-muted)' }}>{step}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                    Submitted: {formatDate(c.createdAt)}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    <strong>Dept:</strong> {c.department} • <strong>Urgency:</strong> {c.urgency}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}

export default function TrackPage() {
  return (
    <NotificationProvider>
      <NavyFluidBackground />
      <TrackingDashboard />
    </NotificationProvider>
  );
}
