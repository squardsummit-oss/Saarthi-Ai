'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom blue dot marker for user location
const userLocationIcon = L.divIcon({
  className: 'custom-location-marker',
  html: `<div style="
    width: 18px; height: 18px;
    background: #4285F4;
    border: 3px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 6px rgba(66,133,244,0.3), 0 2px 8px rgba(0,0,0,0.4);
    animation: pulseMarker 2s ease-in-out infinite;
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Component to fly/pan to user location whenever it updates
function UpdateMapView({ position, accuracy }: { position: [number, number]; accuracy: number }) {
  const map = useMap();
  const hasFlown = useRef(false);

  useEffect(() => {
    if (!hasFlown.current) {
      // First time: fly to position with animation
      // Choose zoom based on accuracy: better accuracy = more zoom
      const zoom = accuracy < 50 ? 18 : accuracy < 200 ? 17 : accuracy < 500 ? 16 : 15;
      map.flyTo(position, zoom, { duration: 1.5 });
      hasFlown.current = true;
    } else {
      // Subsequent updates: pan smoothly without zoom change
      map.panTo(position);
    }
  }, [map, position, accuracy]);
  return null;
}

export default function SatelliteMap() {
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number>(0);
  const [areaName, setAreaName] = useState('Detecting location...');
  const [mapReady, setMapReady] = useState(false);
  const [locStatus, setLocStatus] = useState<'detecting' | 'found' | 'error'>('detecting');

  // Default center (Hyderabad)
  const defaultCenter: [number, number] = [17.385, 78.4867];

  useEffect(() => {
    let geocoded = false;
    let watchId: number | undefined;

    const handlePosition = async (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = pos.coords.accuracy; // accuracy in meters

      setUserPos([lat, lng]);
      setAccuracy(acc);
      setLocStatus('found');

      // Reverse geocode only once on first accurate position
      if (!geocoded && acc < 500) {
        geocoded = true;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`
          );
          const data = await res.json();
          const addr = data.address || {};
          // Get the most specific area name available
          const area = addr.road || addr.neighbourhood || addr.suburb || addr.village || addr.town || addr.city_district || addr.county || addr.city || 'Your Location';
          const locality = addr.suburb || addr.village || addr.town || addr.city || '';
          setAreaName(locality ? `${area}, ${locality}` : area);
        } catch {
          setAreaName('Your Location');
        }
      }
    };

    const handleError = (err: GeolocationPositionError) => {
      console.error('Geolocation error:', err.message);
      setLocStatus('error');
      if (err.code === 1) {
        setAreaName('Location permission denied');
      } else if (err.code === 2) {
        setAreaName('Location unavailable');
      } else {
        setAreaName('Location timed out');
      }
    };

    if ('geolocation' in navigator) {
      // HIGH ACCURACY options — forces GPS on mobile devices
      const highAccuracyOpts: PositionOptions = {
        enableHighAccuracy: true,  // Use GPS, not just WiFi/cell tower
        maximumAge: 0,             // Never use cached position
        timeout: 20000,            // Wait up to 20s for GPS lock
      };

      // Get initial position
      navigator.geolocation.getCurrentPosition(handlePosition, handleError, highAccuracyOpts);

      // Continuously watch for better accuracy
      watchId = navigator.geolocation.watchPosition(handlePosition, handleError, highAccuracyOpts);

      setMapReady(true);
      return () => {
        if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      };
    } else {
      setAreaName('Geolocation not supported');
      setLocStatus('error');
    }
    setMapReady(true);
  }, []);

  if (!mapReady) {
    return (
      <div style={{
        width: '100%', height: 220, borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-secondary)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        border: '1px solid var(--border)',
      }}>
        <div className="step-spinner" style={{ width: 24, height: 24 }} />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <style>{`
        .custom-location-marker {
          background: transparent !important;
          border: none !important;
        }
        @keyframes pulseMarker {
          0%, 100% { box-shadow: 0 0 0 6px rgba(66,133,244,0.3), 0 2px 8px rgba(0,0,0,0.4); }
          50% { box-shadow: 0 0 0 14px rgba(66,133,244,0.1), 0 2px 8px rgba(0,0,0,0.4); }
        }
        .leaflet-container {
          background: #0a1628 !important;
        }
        .leaflet-control-zoom a {
          background: rgba(15,20,35,0.9) !important;
          color: #fff !important;
          border-color: rgba(255,255,255,0.1) !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(30,40,70,0.95) !important;
        }
        .leaflet-control-attribution {
          background: rgba(15,20,35,0.7) !important;
          color: rgba(255,255,255,0.5) !important;
          font-size: 9px !important;
        }
        .leaflet-control-attribution a {
          color: rgba(100,180,255,0.7) !important;
        }
        .leaflet-popup-content-wrapper {
          background: rgba(15,20,35,0.95) !important;
          color: #fff !important;
          border-radius: 12px !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
        }
        .leaflet-popup-tip {
          background: rgba(15,20,35,0.95) !important;
        }
      `}</style>
      <MapContainer
        center={userPos || defaultCenter}
        zoom={userPos ? 17 : 12}
        style={{ height: 220, width: '100%' }}
        zoomControl={true}
        attributionControl={true}
      >
        <TileLayer
          attribution='&copy; Esri'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        {/* Road labels overlay for context */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
          opacity={0.7}
        />
        {/* Place name labels */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          opacity={0.8}
        />
        {userPos && (
          <>
            {/* Accuracy circle — shows GPS precision area */}
            <Circle
              center={userPos}
              radius={accuracy}
              pathOptions={{
                color: '#4285F4',
                fillColor: '#4285F4',
                fillOpacity: 0.1,
                weight: 1,
                opacity: 0.3,
              }}
            />
            <Marker position={userPos} icon={userLocationIcon}>
              <Popup>
                <div style={{ textAlign: 'center', padding: '4px 0' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>📍 {areaName}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{userPos[0].toFixed(6)}, {userPos[1].toFixed(6)}</div>
                  <div style={{ fontSize: 10, opacity: 0.5, marginTop: 2 }}>±{Math.round(accuracy)}m accuracy</div>
                </div>
              </Popup>
            </Marker>
            <UpdateMapView position={userPos} accuracy={accuracy} />
          </>
        )}
      </MapContainer>
      <div style={{
        padding: '10px 14px',
        background: 'var(--bg-card)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 13, color: 'var(--text-secondary)',
      }}>
        <span style={{ fontSize: 16 }}>
          {locStatus === 'detecting' ? '🔄' : locStatus === 'found' ? '📍' : '⚠️'}
        </span>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{areaName}</span>
        {userPos && (
          <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
            ±{Math.round(accuracy)}m • {userPos[0].toFixed(5)}°N, {userPos[1].toFixed(5)}°E
          </span>
        )}
      </div>
    </div>
  );
}
