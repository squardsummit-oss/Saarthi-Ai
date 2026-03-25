'use client';

import { useEffect, useRef } from 'react';

export default function NavyFluidBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const blobs = container.querySelectorAll<HTMLDivElement>('.navy-blob');

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let currentX = mouseX;
    let currentY = mouseY;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouseX = e.touches[0].clientX;
        mouseY = e.touches[0].clientY;
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchmove', handleTouchMove, { passive: true });

    let animFrameId: number;

    function animate() {
      animFrameId = requestAnimationFrame(animate);

      currentX += (mouseX - currentX) * 0.12;
      currentY += (mouseY - currentY) * 0.12;

      blobs.forEach((blob, i) => {
        const strength = (i + 1) * 0.04;

        const dx = currentX - window.innerWidth / 2;
        const dy = currentY - window.innerHeight / 2;

        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        const moveX = dx * strength + (dx / distance) * 20;
        const moveY = dy * strength + (dy / distance) * 20;

        blob.style.transform = `translate(${moveX}px, ${moveY}px) scale(${1 + distance / 2000})`;
      });
    }

    animate();

    return () => {
      cancelAnimationFrame(animFrameId);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        overflow: 'hidden',
        background: 'radial-gradient(circle at center, #020617, #01030a)',
        pointerEvents: 'none',
      }}
    >
      <div
        className="navy-blob"
        style={{
          position: 'absolute',
          width: 700,
          height: 700,
          borderRadius: '50%',
          filter: 'blur(140px)',
          opacity: 0.45,
          willChange: 'transform',
          background: '#0a1f44',
          top: -150,
          left: -150,
        }}
      />
      <div
        className="navy-blob"
        style={{
          position: 'absolute',
          width: 700,
          height: 700,
          borderRadius: '50%',
          filter: 'blur(140px)',
          opacity: 0.45,
          willChange: 'transform',
          background: '#1e3a8a',
          bottom: -150,
          right: -150,
        }}
      />
      <div
        className="navy-blob"
        style={{
          position: 'absolute',
          width: 700,
          height: 700,
          borderRadius: '50%',
          filter: 'blur(140px)',
          opacity: 0.45,
          willChange: 'transform',
          background: '#0ea5e9',
          top: '40%',
          left: '30%',
        }}
      />
      <div
        className="navy-blob"
        style={{
          position: 'absolute',
          width: 700,
          height: 700,
          borderRadius: '50%',
          filter: 'blur(140px)',
          opacity: 0.45,
          willChange: 'transform',
          background: '#1d4ed8',
          top: '60%',
          left: '60%',
        }}
      />
    </div>
  );
}
