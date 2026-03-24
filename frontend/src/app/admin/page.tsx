'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BarChart3, Clock, CheckCircle, AlertTriangle, Plus, X, Edit2, Trash2, Volume2, Search, BookOpen, Settings, LogOut, Mail } from 'lucide-react';

import { NotificationProvider, useNotification } from '@/components/NotificationProvider';
import { db, auth } from '../../../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc, getDocs, Timestamp, getDoc, setDoc } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';

interface Complaint {
  id: string;
  originalText: string;
  translatedText: string;
  category: string;
  department: string;
  status: string;
  urgency: string;
  emotion: string;
  location: string;
  areaName?: string;
  userId?: string;
  audioUrl?: string;
  matchedKeywords?: string[];
  confidence?: number;
  createdAt: { seconds: number };
}

interface ServiceSector {
  id: string;
  name: string;
  keywords: string[];
  icon: string;
  contactInfo: string;
  createdAt?: { seconds: number };
}

const statusOptions = ['Pending', 'In Progress', 'Resolved'];

const defaultSectors: Omit<ServiceSector, 'id'>[] = [
  { name: 'Municipality', keywords: ['road', 'pothole', 'drainage', 'garbage', 'street', 'సడక', 'రోడ్', 'सड़क'], icon: '🏛️', contactInfo: 'municipality@gov.in' },
  { name: 'Fire Station', keywords: ['fire', 'burn', 'flame', 'smoke', 'అగ్ని', 'आग'], icon: '🚒', contactInfo: 'fire@gov.in' },
  { name: 'Police', keywords: ['police', 'crime', 'theft', 'robbery', 'murder', 'safety', 'రక్షణ', 'सुरक्षा', 'चोरी'], icon: '🚔', contactInfo: 'police@gov.in' },
  { name: 'Health Emergency', keywords: ['health', 'hospital', 'doctor', 'ambulance', 'sanitation', 'disease', 'ఆరోగ్య', 'स्वास्थ्य'], icon: '🏥', contactInfo: 'health@gov.in' },
  { name: 'Electricity Board', keywords: ['electric', 'power', 'voltage', 'current', 'outage', 'transformer', 'కరెంట్', 'बिजली'], icon: '⚡', contactInfo: 'electricity@gov.in' },
  { name: 'Water Works', keywords: ['water', 'pipe', 'leak', 'supply', 'drain', 'sewage', 'నీరు', 'पानी'], icon: '💧', contactInfo: 'water@gov.in' },
  { name: 'Education', keywords: ['school', 'education', 'teacher', 'college', 'student', 'విద్య', 'शिक्षा'], icon: '📚', contactInfo: 'education@gov.in' },
];

type Tab = 'complaints' | 'sectors' | 'analytics' | 'knowledge' | 'settings';

function AdminDashboard() {
  const router = useRouter();
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState<Tab>('complaints');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [sectors, setSectors] = useState<ServiceSector[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectorsLoading, setSectorsLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  // Auth guard — redirect non-admin users
  useEffect(() => {
    // Check session flag synchronously before auth fires
    let isAdminSession = false;
    try { isAdminSession = sessionStorage.getItem('isAdminSession') === 'true'; } catch { /* ignore */ }

    // If session flag exists, render immediately — don't wait for anything
    if (isAdminSession) {
      setAuthChecked(true);
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try { sessionStorage.removeItem('isAdminSession'); } catch { /* ignore */ }
        router.replace('/login');
        return;
      }

      // If no session flag yet, do a fast 200ms race check
      if (!isAdminSession) {
        const result = await Promise.race([
          getDoc(doc(db, 'users', user.uid))
            .then((d) => d.exists() && d.data().role === 'user' ? 'blocked' : 'ok')
            .catch(() => 'ok'),
          new Promise<string>((r) => setTimeout(() => r('timeout'), 200)),
        ]);
        if (result === 'blocked') {
          await signOut(auth);
          router.replace('/login');
          return;
        }
        try { sessionStorage.setItem('isAdminSession', 'true'); } catch { /* ignore */ }
        setAuthChecked(true);
      }

      // Background: verify role and ensure admin doc exists (non-blocking)
      const userDocRef = doc(db, 'users', user.uid);
      getDoc(userDocRef).then(async (snap) => {
        if (snap.exists() && snap.data().role === 'user') {
          // Snuck in as user — kick out
          try { sessionStorage.removeItem('isAdminSession'); } catch { /* ignore */ }
          await signOut(auth);
          router.replace('/login');
        } else if (!snap.exists()) {
          // Create admin doc in background
          await setDoc(userDocRef, {
            role: 'admin', email: user.email || '', createdAt: new Date().toISOString(),
          }).catch(() => {});
        }
      }).catch(() => {});
    });
    return () => unsub();
  }, [router]);

  // Complaints state
  const [filterDept, setFilterDept] = useState('all');
  const [filterMandal, setFilterMandal] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Sector form state
  const [showSectorForm, setShowSectorForm] = useState(false);
  const [editingSector, setEditingSector] = useState<ServiceSector | null>(null);
  const [sectorName, setSectorName] = useState('');
  const [sectorKeywords, setSectorKeywords] = useState('');
  const [sectorIcon, setSectorIcon] = useState('🏢');
  const [sectorContact, setSectorContact] = useState('');

  // Settings state
  const [notificationEmails, setNotificationEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [emailsLoading, setEmailsLoading] = useState(true);
  const [savingEmails, setSavingEmails] = useState(false);

  // Fetch complaints with robust error handling
  useEffect(() => {
    let unsubscribed = false;

    // Simple query — no orderBy to avoid needing composite index
    const q = query(collection(db, 'complaints'));
    const unsub = onSnapshot(q, (snap) => {
      if (unsubscribed) return;
      const data: Complaint[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Complaint));
      // Sort client-side by createdAt descending
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setComplaints(data);
      setLoading(false);
    }, (error) => {
      console.error('Admin complaints fetch error:', error);
      setLoading(false);
    });

    return () => { unsubscribed = true; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch sectors and seed defaults if empty
  useEffect(() => {
    const fetchAndSeed = async () => {
      const snap = await getDocs(collection(db, 'serviceSectors'));
      if (snap.empty) {
        // Seed default sectors
        for (const sector of defaultSectors) {
          await addDoc(collection(db, 'serviceSectors'), {
            ...sector,
            createdAt: Timestamp.now(),
          });
        }
        showNotification('success', 'Sectors Created', 'Default service sectors have been initialized.');
      }
    };
    fetchAndSeed();

    const unsub = onSnapshot(collection(db, 'serviceSectors'), (snap) => {
      const data: ServiceSector[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as ServiceSector));
      setSectors(data);
      setSectorsLoading(false);
    });
    return () => unsub();
  }, []);

  // Fetch admin notification emails
  useEffect(() => {
    const fetchEmails = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'adminSettings', 'notifications'));
        if (settingsDoc.exists()) {
          setNotificationEmails(settingsDoc.data().emails || []);
        }
      } catch (err) {
        console.error('Failed to fetch email settings:', err);
      }
      setEmailsLoading(false);
    };
    fetchEmails();
  }, []);

  const addEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      showNotification('warning', 'Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (notificationEmails.includes(email)) {
      showNotification('warning', 'Duplicate', 'This email is already in the list.');
      return;
    }
    const updatedEmails = [...notificationEmails, email];
    setSavingEmails(true);
    try {
      await setDoc(doc(db, 'adminSettings', 'notifications'), { emails: updatedEmails }, { merge: true });
      setNotificationEmails(updatedEmails);
      setNewEmail('');
      showNotification('success', 'Email Added', `${email} has been added to notifications.`);
    } catch {
      showNotification('error', 'Failed', 'Could not save email.');
    }
    setSavingEmails(false);
  };

  const removeEmail = async (emailToRemove: string) => {
    const updatedEmails = notificationEmails.filter(e => e !== emailToRemove);
    setSavingEmails(true);
    try {
      await setDoc(doc(db, 'adminSettings', 'notifications'), { emails: updatedEmails }, { merge: true });
      setNotificationEmails(updatedEmails);
      showNotification('success', 'Email Removed', `${emailToRemove} has been removed.`);
    } catch {
      showNotification('error', 'Failed', 'Could not remove email.');
    }
    setSavingEmails(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      await updateDoc(doc(db, 'complaints', id), { status: newStatus });

      // Create notification for the user
      const complaint = complaints.find(c => c.id === id);
      if (complaint?.userId && complaint.userId !== 'anonymous') {
        const notifTitle = newStatus === 'Resolved' ? 'Issue Resolved ✅' :
                          newStatus === 'In Progress' ? 'Complaint In Progress' :
                          newStatus === 'Pending' ? 'Complaint Acknowledged' :
                          'Status Update';
        const notifMessage = `Your ${complaint.category || 'complaint'} (#${id.slice(0,8).toUpperCase()}) has been updated to: ${newStatus}. Department: ${complaint.department || 'General'}.`;
        const notifType = newStatus === 'Resolved' ? 'status' : newStatus === 'In Progress' ? 'update' : 'status';

        await addDoc(collection(db, 'notifications'), {
          userId: complaint.userId,
          title: notifTitle,
          message: notifMessage,
          type: notifType,
          complaintId: id,
          read: false,
          createdAt: Timestamp.now(),
        });
      }

      showNotification('success', 'Status Updated', `Complaint updated to: ${newStatus}`);
    } catch {
      showNotification('error', 'Update Failed', 'Could not update complaint status.');
    }
    setUpdatingId(null);
  };

  // Sector CRUD
  const openSectorForm = (sector?: ServiceSector) => {
    if (sector) {
      setEditingSector(sector);
      setSectorName(sector.name);
      setSectorKeywords(sector.keywords.join(', '));
      setSectorIcon(sector.icon);
      setSectorContact(sector.contactInfo);
    } else {
      setEditingSector(null);
      setSectorName('');
      setSectorKeywords('');
      setSectorIcon('🏢');
      setSectorContact('');
    }
    setShowSectorForm(true);
  };

  const saveSector = async () => {
    if (!sectorName.trim()) {
      showNotification('warning', 'Missing Name', 'Please enter a sector name.');
      return;
    }
    const keywords = sectorKeywords.split(',').map(k => k.trim()).filter(Boolean);
    try {
      if (editingSector) {
        await updateDoc(doc(db, 'serviceSectors', editingSector.id), {
          name: sectorName,
          keywords,
          icon: sectorIcon,
          contactInfo: sectorContact,
        });
        showNotification('success', 'Sector Updated', `"${sectorName}" has been updated.`);
      } else {
        await addDoc(collection(db, 'serviceSectors'), {
          name: sectorName,
          keywords,
          icon: sectorIcon,
          contactInfo: sectorContact,
          createdAt: Timestamp.now(),
        });
        showNotification('success', 'Sector Created', `"${sectorName}" has been added.`);
      }
      setShowSectorForm(false);
    } catch {
      showNotification('error', 'Save Failed', 'Could not save sector.');
    }
  };

  const deleteSector = async (id: string, name: string) => {
    try {
      await deleteDoc(doc(db, 'serviceSectors', id));
      showNotification('success', 'Sector Deleted', `"${name}" has been removed.`);
    } catch {
      showNotification('error', 'Delete Failed', 'Could not delete sector.');
    }
  };

  // Derived data
  const departments = [...new Set(complaints.map(c => c.department))];
  const mandals = [...new Set(complaints.map(c => c.location))];

  const filtered = complaints
    .filter(c => filterDept === 'all' || c.department === filterDept)
    .filter(c => filterMandal === 'all' || c.location === filterMandal)
    .filter(c => !searchQuery || c.translatedText?.toLowerCase().includes(searchQuery.toLowerCase()) || c.originalText?.toLowerCase().includes(searchQuery.toLowerCase()) || c.id.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const urgencyOrder: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      return (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3);
    });

  const total = complaints.length;
  const pending = complaints.filter(c => c.status !== 'Resolved').length;
  const resolved = complaints.filter(c => c.status === 'Resolved').length;
  const sos = complaints.filter(c => c.urgency === 'Critical' || c.urgency === 'High').length;

  const formatDate = (ts: { seconds: number }) => {
    return new Date(ts.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  // Analytics data
  const categoryBreakdown = complaints.reduce<Record<string, number>>((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1;
    return acc;
  }, {});
  const statusBreakdown = complaints.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});
  const urgencyBreakdown = complaints.reduce<Record<string, number>>((acc, c) => {
    acc[c.urgency] = (acc[c.urgency] || 0) + 1;
    return acc;
  }, {});

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'complaints', label: 'Complaints', icon: '📋' },
    { key: 'sectors', label: 'Sectors', icon: '🏗️' },
    { key: 'analytics', label: 'Analytics', icon: '📊' },
    { key: 'knowledge', label: 'Knowledge', icon: '📖' },
    { key: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  if (!authChecked) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="step-spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div className="page-container wide" style={{ paddingTop: 20, maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn-icon" onClick={() => router.push('/login')}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 800, flex: 1 }}>🛡️ Admin Dashboard</h1>
        <button
          onClick={async () => { try { sessionStorage.removeItem('isAdminSession'); } catch { /* ignore */ } await signOut(auth); router.push('/login'); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)',
            borderRadius: 'var(--radius-full)', padding: '8px 16px',
            color: '#c9a84c', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-body)',
            transition: 'all 0.2s ease',
          }}
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>

      {/* Stats Row */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <BarChart3 size={20} color="var(--accent-primary)" />
          <div className="admin-stat-value">{total}</div>
          <div className="admin-stat-label">Total</div>
        </div>
        <div className="admin-stat-card">
          <Clock size={20} color="var(--warning)" />
          <div className="admin-stat-value" style={{ color: 'var(--warning)' }}>{pending}</div>
          <div className="admin-stat-label">Pending</div>
        </div>
        <div className="admin-stat-card">
          <CheckCircle size={20} color="var(--success)" />
          <div className="admin-stat-value" style={{ color: 'var(--success)' }}>{resolved}</div>
          <div className="admin-stat-label">Resolved</div>
        </div>
        <div className="admin-stat-card">
          <AlertTriangle size={20} color="var(--error)" />
          <div className="admin-stat-value" style={{ color: 'var(--error)' }}>{sos}</div>
          <div className="admin-stat-label">High Priority</div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="admin-tab-bar">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`admin-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ═══ TAB: COMPLAINTS ═══ */}
      {activeTab === 'complaints' && (
        <div className="fade-in">
          {/* Search + Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div className="admin-search-box" style={{ flex: 1, minWidth: 200 }}>
              <Search size={16} color="var(--text-muted)" />
              <input
                className="admin-search-input"
                placeholder="Search complaints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select className="select" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
              <option value="all">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="select" value={filterMandal} onChange={(e) => setFilterMandal(e.target.value)}>
              <option value="all">All Mandals</option>
              {mandals.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(c => (
                <div key={c.id} className="admin-complaint-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>#{c.id.slice(0, 8).toUpperCase()}</span>
                        <span className={`badge ${c.urgency === 'Critical' || c.urgency === 'High' ? 'error' : c.urgency === 'Medium' ? 'warning' : 'success'}`}>
                          {c.urgency}
                        </span>
                        {c.audioUrl && (
                          <button
                            className="admin-audio-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              const audio = new Audio(c.audioUrl);
                              audio.play();
                            }}
                            title="Play audio recording"
                          >
                            <Volume2 size={14} />
                            <span>Play</span>
                          </button>
                        )}
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{c.translatedText || c.originalText}</p>
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        <span>📁 {c.category}</span>
                        <span>🏛️ {c.department}</span>
                        <span>📍 {c.location}</span>
                        <span>🕐 {c.createdAt ? formatDate(c.createdAt) : 'N/A'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <select
                        className="select"
                        value={c.status}
                        onChange={(e) => updateStatus(c.id, e.target.value)}
                        disabled={updatingId === c.id}
                        style={{ minWidth: 140, fontSize: 13, padding: '8px 32px 8px 12px' }}
                      >
                        {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {updatingId === c.id && <div className="step-spinner" style={{ width: 18, height: 18 }} />}
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No complaints match your filters.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: SERVICE SECTORS ═══ */}
      {activeTab === 'sectors' && (
        <div className="fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Service Sectors</h2>
            <button className="btn-primary" onClick={() => openSectorForm()} style={{ padding: '10px 20px', fontSize: 13 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={16} /> Add Sector</span>
            </button>
          </div>

          {/* Sector Form Modal */}
          {showSectorForm && (
            <div className="admin-modal-overlay" onClick={() => setShowSectorForm(false)}>
              <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700 }}>{editingSector ? 'Edit Sector' : 'New Sector'}</h3>
                  <button className="btn-icon" onClick={() => setShowSectorForm(false)} style={{ width: 36, height: 36 }}>
                    <X size={16} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>SECTOR NAME</label>
                    <input className="input" placeholder="e.g. Animal Control" value={sectorName} onChange={(e) => setSectorName(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>KEYWORDS (comma-separated)</label>
                    <input className="input" placeholder="e.g. dog, animal, stray, wild" value={sectorKeywords} onChange={(e) => setSectorKeywords(e.target.value)} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>ICON (emoji)</label>
                      <input className="input" placeholder="🏢" value={sectorIcon} onChange={(e) => setSectorIcon(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>CONTACT</label>
                      <input className="input" placeholder="dept@gov.in" value={sectorContact} onChange={(e) => setSectorContact(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <button className="btn-primary" onClick={saveSector} style={{ flex: 1, justifyContent: 'center', padding: '12px 24px' }}>
                      <span>{editingSector ? 'Update Sector' : 'Create Sector'}</span>
                    </button>
                    <button className="btn-secondary" onClick={() => setShowSectorForm(false)} style={{ padding: '12px 24px' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sectors Grid */}
          {sectorsLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 140 }} />)}
            </div>
          ) : (
            <div className="admin-sectors-grid">
              {sectors.map(sector => (
                <div key={sector.id} className="admin-sector-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 28 }}>{sector.icon}</span>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 700 }}>{sector.name}</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sector.contactInfo}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon" style={{ width: 32, height: 32, border: 'none' }} onClick={() => openSectorForm(sector)}>
                        <Edit2 size={14} />
                      </button>
                      <button className="btn-icon" style={{ width: 32, height: 32, border: 'none', color: 'var(--error)' }} onClick={() => deleteSector(sector.id, sector.name)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {sector.keywords.map((kw, i) => (
                      <span key={i} className="admin-keyword-tag">{kw}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: ANALYTICS ═══ */}
      {activeTab === 'analytics' && (
        <div className="fade-in">
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>📊 Analytics Overview</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {/* Category Breakdown */}
            <div className="admin-analytics-card">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text-muted)' }}>CATEGORY BREAKDOWN</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{cat}</span>
                      <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{count}</span>
                    </div>
                    <div className="admin-progress-bar">
                      <div className="admin-progress-fill" style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
                {Object.keys(categoryBreakdown).length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data yet.</p>
                )}
              </div>
            </div>

            {/* Status Distribution */}
            <div className="admin-analytics-card">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text-muted)' }}>STATUS DISTRIBUTION</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {statusOptions.map(status => {
                  const count = statusBreakdown[status] || 0;
                  const colors: Record<string, string> = {
                    'Submitted': 'var(--info)',
                    'Pending': 'var(--warning)',
                    'In Progress': 'var(--accent-primary)',
                    'Resolved': 'var(--success)',
                  };
                  return (
                    <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: colors[status] }} />
                      <span style={{ fontSize: 13, flex: 1 }}>{status}</span>
                      <span style={{ fontWeight: 700, fontSize: 18 }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Urgency Distribution */}
            <div className="admin-analytics-card">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text-muted)' }}>URGENCY LEVELS</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {['Critical', 'High', 'Medium', 'Low'].map(level => {
                  const count = urgencyBreakdown[level] || 0;
                  const colors: Record<string, string> = {
                    'Critical': '#ff1744',
                    'High': 'var(--error)',
                    'Medium': 'var(--warning)',
                    'Low': 'var(--success)',
                  };
                  return (
                    <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className={`badge ${level === 'Critical' || level === 'High' ? 'error' : level === 'Medium' ? 'warning' : 'success'}`} style={{ minWidth: 70, justifyContent: 'center' }}>
                        {level}
                      </span>
                      <div className="admin-progress-bar" style={{ flex: 1 }}>
                        <div className="admin-progress-fill" style={{ width: `${total > 0 ? (count / total) * 100 : 0}%`, background: colors[level] }} />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 14, minWidth: 24, textAlign: 'right' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="admin-analytics-card">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text-muted)' }}>RECENT ACTIVITY</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {complaints.slice(0, 5).map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.status === 'Resolved' ? 'var(--success)' : 'var(--warning)', flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.translatedText || c.originalText}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11, flexShrink: 0 }}>
                      {c.createdAt ? formatDate(c.createdAt) : ''}
                    </span>
                  </div>
                ))}
                {complaints.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No activity yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: KNOWLEDGE PANEL ═══ */}
      {activeTab === 'knowledge' && (
        <div className="fade-in">
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>📖 AI Knowledge Panel</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>See how AI categorized each complaint: matched keywords, routed sector, and confidence level.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {complaints.filter(c => c.matchedKeywords && c.matchedKeywords.length > 0).length === 0 ? (
              <div className="admin-analytics-card" style={{ textAlign: 'center', padding: 40 }}>
                <BookOpen size={40} color="var(--text-muted)" style={{ marginBottom: 12, opacity: 0.3 }} />
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No AI routing data yet.</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Submit complaints with matching sector keywords to see AI routing details here.</p>
              </div>
            ) : (
              complaints
                .filter(c => c.matchedKeywords && c.matchedKeywords.length > 0)
                .map(c => (
                  <div key={c.id} className="admin-knowledge-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>#{c.id.slice(0, 8).toUpperCase()}</span>
                        <p style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{c.translatedText || c.originalText}</p>
                      </div>
                      <div className="admin-confidence-badge" data-level={
                        (c.confidence || 0) >= 75 ? 'high' : (c.confidence || 0) >= 50 ? 'medium' : 'low'
                      }>
                        {c.confidence || 0}%
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                      <span>🏛️ Routed to: <strong style={{ color: 'var(--text-primary)' }}>{c.department}</strong></span>
                      <span>📁 Category: <strong style={{ color: 'var(--text-primary)' }}>{c.category}</strong></span>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>MATCHED KEYWORDS:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {c.matchedKeywords!.map((kw, i) => (
                          <span key={i} className="admin-keyword-tag matched">🔑 {kw}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB: SETTINGS ═══ */}
      {activeTab === 'settings' && (
        <div className="fade-in">
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>⚙️ Settings</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Manage notification emails — add support or personal emails to receive complaint alerts.</p>

          {/* Add Email */}
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mail size={18} color="var(--accent-primary)" />
              Notification Email Addresses
            </h3>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <input
                className="input"
                type="email"
                placeholder="Enter email address (support or personal)..."
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                style={{ flex: 1 }}
              />
              <button
                className="btn-primary"
                onClick={addEmail}
                disabled={savingEmails || !newEmail.trim()}
                style={{ padding: '10px 20px', fontSize: 13, whiteSpace: 'nowrap' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={16} />
                  Add Email
                </span>
              </button>
            </div>

            {/* Email List */}
            {emailsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 48 }} />)}
              </div>
            ) : notificationEmails.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>
                <Mail size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                <p>No notification emails configured yet.</p>
                <p style={{ fontSize: 12 }}>Add support emails (e.g., helpdesk@org.in) or personal emails to receive complaint alerts.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {notificationEmails.map((email) => (
                  <div
                    key={email}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Mail size={16} color="var(--accent-primary)" />
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{email}</span>
                      {email.endsWith('.gov.in') || email.endsWith('.org.in') ? (
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--success-bg)', color: 'var(--success)', fontWeight: 600 }}>OFFICIAL</span>
                      ) : (
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(201,168,76,0.1)', color: '#c9a84c', fontWeight: 600 }}>PERSONAL</span>
                      )}
                    </div>
                    <button
                      className="btn-icon"
                      style={{ width: 32, height: 32, border: 'none', color: 'var(--error)' }}
                      onClick={() => removeEmail(email)}
                      disabled={savingEmails}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="card" style={{ padding: 16, borderLeft: '3px solid var(--accent-primary)' }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              💡 <strong>Tip:</strong> You can add both official support emails (e.g., helpdesk@gov.in) and personal emails (e.g., admin@gmail.com). All listed emails will receive complaint notifications.
            </p>
          </div>
        </div>
      )}



    </div>
  );
}

export default function AdminPage() {
  return (
    <NotificationProvider>
      <AdminDashboard />
    </NotificationProvider>
  );
}
