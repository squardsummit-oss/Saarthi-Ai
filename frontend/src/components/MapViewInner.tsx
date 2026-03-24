'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, limit } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Complaint {
  id: string;
  category: string;
  status: string;
  location: string;
  areaName: string;
  translatedText: string;
  department: string;
  urgency: string;
}

function parseCoords(loc: string): [number, number] | null {
  if (!loc || loc === 'Not available') return null;
  const parts = loc.split(',').map(s => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[0], parts[1]];
  }
  return null;
}

function complaintIcon(status: string) {
  const isResolved = status === 'Resolved';
  return L.divIcon({
    className: 'complaint-map-marker',
    html: `<div style="
      width: 14px; height: 14px;
      background: ${isResolved ? '#00e676' : '#ff5252'};
      border: 2px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 0 4px ${isResolved ? 'rgba(0,230,118,0.25)' : 'rgba(255,82,82,0.25)'}, 0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export default function MapViewInner() {
  const router = useRouter();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'complaints'), limit(200));
    const unsub = onSnapshot(q, (snap) => {
      const data: Complaint[] = [];
      snap.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Complaint));
      setComplaints(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
        () => {},
        { timeout: 20000, enableHighAccuracy: true, maximumAge: 0 }
      );
    }
  }, []);

  const mappable = complaints
    .map(c => ({ ...c, coords: parseCoords(c.location) }))
    .filter(c => c.coords !== null) as (Complaint & { coords: [number, number] })[];

  const defaultCenter: [number, number] = userPos || [17.385, 78.4867];

  const grouped: Record<string, Complaint[]> = {};
  complaints.forEach(c => {
    const loc = c.areaName || c.location || 'Unknown';
    if (!grouped[loc]) grouped[loc] = [];
    grouped[loc].push(c);
  });

  const userIcon = L.divIcon({
    className: 'user-pos-marker',
    html: `<div style="
      width: 16px; height: 16px;
      background: #4fc3f7;
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 0 6px rgba(79,195,247,0.3), 0 2px 8px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

  return (
    <div className="page-container" style={{ paddingTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn-icon" onClick={() => router.push('/')}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>🗺️ Complaint Map</h1>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {complaints.length} complaints
        </span>
      </div>

      <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 24 }}>
        <style>{`
          .complaint-map-marker, .user-pos-marker {
            background: transparent !important;
            border: none !important;
          }
          .map-leaflet-container .leaflet-container {
            background: #0a1628 !important;
          }
          .map-leaflet-container .leaflet-control-zoom a {
            background: rgba(15,20,35,0.9) !important;
            color: #fff !important;
            border-color: rgba(255,255,255,0.1) !important;
          }
          .map-leaflet-container .leaflet-control-zoom a:hover {
            background: rgba(30,40,70,0.95) !important;
          }
          .map-leaflet-container .leaflet-control-attribution {
            background: rgba(15,20,35,0.7) !important;
            color: rgba(255,255,255,0.5) !important;
            font-size: 9px !important;
          }
          .map-leaflet-container .leaflet-control-attribution a {
            color: rgba(100,180,255,0.7) !important;
          }
          .map-leaflet-container .leaflet-popup-content-wrapper {
            background: rgba(15,20,35,0.95) !important;
            color: #fff !important;
            border-radius: 12px !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
          }
          .map-leaflet-container .leaflet-popup-tip {
            background: rgba(15,20,35,0.95) !important;
          }
        `}</style>
        <div className="map-leaflet-container">
          <MapContainer
            center={defaultCenter}
            zoom={userPos ? 13 : 10}
            style={{ height: 350, width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
              opacity={0.6}
            />
            {userPos && (
              <Marker position={userPos} icon={userIcon}>
                <Popup>
                  <div style={{ textAlign: 'center', padding: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>📍 Your Location</div>
                  </div>
                </Popup>
              </Marker>
            )}
            {mappable.map(c => (
              <Marker key={c.id} position={c.coords} icon={complaintIcon(c.status)}>
                <Popup>
                  <div style={{ padding: 4, minWidth: 160 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{c.category}</div>
                    <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>{c.areaName || c.location}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: c.status === 'Resolved' ? 'rgba(0,230,118,0.2)' : 'rgba(255,82,82,0.2)', color: c.status === 'Resolved' ? '#00e676' : '#ff5252' }}>{c.status}</span>
                      {c.urgency && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,171,64,0.15)', color: '#ffab40' }}>{c.urgency}</span>}
                    </div>
                    {c.translatedText && <div style={{ fontSize: 11, marginTop: 6, lineHeight: 1.4, opacity: 0.8 }}>{c.translatedText.substring(0, 80)}...</div>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Area Breakdown</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(grouped).sort((a, b) => b[1].length - a[1].length).map(([loc, items]) => {
          const unresolved = items.filter(c => c.status !== 'Resolved').length;
          return (
            <div key={loc} className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{loc}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {items.length} total • {unresolved} active
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {unresolved > 3 && <span className="badge error">High Issue Zone</span>}
                </div>
              </div>
            </div>
          );
        })}
        {Object.keys(grouped).length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            No complaints to display on map.
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
