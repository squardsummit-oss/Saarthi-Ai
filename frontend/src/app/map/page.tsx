'use client';

import dynamic from 'next/dynamic';
import { NotificationProvider } from '@/components/NotificationProvider';
import NavyFluidBackground from '@/components/NavyFluidBackground';

// Dynamically import the map component with SSR disabled
// This prevents Leaflet from being loaded on the server where `window` is not defined
const MapViewInner = dynamic(
  () => import('@/components/MapViewInner'),
  { 
    ssr: false,
    loading: () => (
      <div className="page-container" style={{ paddingTop: 40, textAlign: 'center' }}>
        <div className="step-spinner" style={{ margin: '0 auto' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 16 }}>Loading map...</p>
      </div>
    ),
  }
);

export default function MapPage() {
  return (
    <NotificationProvider>
      <NavyFluidBackground />
      <MapViewInner />
    </NotificationProvider>
  );
}
