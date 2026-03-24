'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell, Check } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { NotificationProvider } from '@/components/NotificationProvider';
import { db, auth } from '../../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  createdAt: { seconds: number };
  read: boolean;
  type: 'status' | 'update' | 'alert';
  complaintId?: string;
}

function timeAgo(seconds: number): string {
  const now = Date.now() / 1000;
  const diff = now - seconds;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

function NotificationsView() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Get current user
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null);
    });
    return () => unsub();
  }, []);

  // Listen for real notifications from Firestore
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const data: NotificationItem[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as NotificationItem));
      setNotifications(data);
      setLoading(false);
    }, () => {
      // If the query fails (e.g. index not created), load without ordering
      const fallbackQ = query(
        collection(db, 'notifications'),
        where('userId', '==', userId)
      );
      const fallbackUnsub = onSnapshot(fallbackQ, (snap) => {
        const data: NotificationItem[] = [];
        snap.forEach(d => data.push({ id: d.id, ...d.data() } as NotificationItem));
        // Sort client-side
        data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setNotifications(data);
        setLoading(false);
      });
      return () => fallbackUnsub();
    });

    return () => unsub();
  }, [userId]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.read).forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const typeColors: Record<string, string> = {
    status: 'var(--accent-primary)',
    update: 'var(--warning)',
    alert: 'var(--error)',
  };

  return (
    <div className="page-container" style={{ paddingTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn-icon" onClick={() => router.push('/')}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, flex: 1 }}>
          Notifications
          {unreadCount > 0 && (
            <span style={{ background: 'var(--error)', color: '#fff', borderRadius: 'var(--radius-full)', padding: '2px 8px', fontSize: 12, fontWeight: 700, marginLeft: 8 }}>
              {unreadCount}
            </span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button className="btn-secondary" onClick={markAllRead} style={{ padding: '6px 12px', fontSize: 12 }}>
            <Check size={14} /> <span>Mark all</span>
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div className="step-spinner" style={{ margin: '0 auto 16px', width: 28, height: 28 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Bell size={40} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No notifications yet</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
            You&apos;ll be notified when an admin updates your complaint
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notifications.map((n) => (
            <div
              key={n.id}
              className="card"
              onClick={() => markRead(n.id)}
              style={{
                padding: 16,
                cursor: 'pointer',
                opacity: n.read ? 0.6 : 1,
                borderLeft: `3px solid ${typeColors[n.type] || 'var(--accent-primary)'}`,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{n.title}</span>
                {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-primary)' }} />}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>{n.message}</p>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {n.createdAt ? timeAgo(n.createdAt.seconds) : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <NotificationProvider>
      <NotificationsView />
    </NotificationProvider>
  );
}
