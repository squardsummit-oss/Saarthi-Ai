'use client';

import { useEffect, useRef, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  opacity: number;
  hue: number;
  rotation: number;
  rotationSpeed: number;
}

export default function SmokerCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const prevMouseRef = useRef({ x: -1000, y: -1000 });
  const rafRef = useRef<number>(0);
  const isActiveRef = useRef(false);

  const createParticle = useCallback((x: number, y: number, vxBase: number, vyBase: number) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 1.5 + 0.3;
    const particle: Particle = {
      x,
      y,
      vx: Math.cos(angle) * speed + vxBase * 0.15,
      vy: Math.sin(angle) * speed + vyBase * 0.15 - 0.5, // slight upward drift like real smoke
      life: 0,
      maxLife: Math.random() * 60 + 40, // frames
      size: Math.random() * 25 + 10,
      opacity: Math.random() * 0.4 + 0.25,
      hue: Math.random() * 60 + 240, // 240-300 = blue to purple range
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.08,
    };
    return particle;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Set canvas size
    const setSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setSize();
    window.addEventListener('resize', setSize);

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      prevMouseRef.current.x = mouseRef.current.x;
      prevMouseRef.current.y = mouseRef.current.y;
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      isActiveRef.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        prevMouseRef.current.x = mouseRef.current.x;
        prevMouseRef.current.y = mouseRef.current.y;
        mouseRef.current.x = e.touches[0].clientX;
        mouseRef.current.y = e.touches[0].clientY;
        isActiveRef.current = true;
      }
    };

    const handleMouseLeave = () => {
      isActiveRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    // Animation loop
    let lastSpawn = 0;

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const now = performance.now();
      const particles = particlesRef.current;

      // Spawn new particles when cursor is moving
      if (isActiveRef.current && now - lastSpawn > 16) { // ~60 spawn rate
        const dx = mouseRef.current.x - prevMouseRef.current.x;
        const dy = mouseRef.current.y - prevMouseRef.current.y;
        const speed = Math.sqrt(dx * dx + dy * dy);

        // More particles when moving faster
        const count = Math.min(Math.floor(speed * 0.3) + 1, 5);
        for (let i = 0; i < count; i++) {
          const offsetX = (Math.random() - 0.5) * 8;
          const offsetY = (Math.random() - 0.5) * 8;
          particles.push(
            createParticle(
              mouseRef.current.x + offsetX,
              mouseRef.current.y + offsetY,
              dx, dy
            )
          );
        }
        lastSpawn = now;
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;

        // Remove dead particles
        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }

        const progress = p.life / p.maxLife;

        // Physics
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.97; // friction
        p.vy *= 0.97;
        p.vy -= 0.02; // slight upward drift (smoke rises)
        p.rotation += p.rotationSpeed;

        // Size grows then shrinks
        const sizeProgress = progress < 0.3
          ? progress / 0.3  // grow
          : 1 - (progress - 0.3) / 0.7; // shrink
        const currentSize = p.size * (0.3 + sizeProgress * 0.7);

        // Opacity fades out
        const currentOpacity = p.opacity * (1 - progress) * (1 - progress);

        // Draw smoke puff
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        // Gradient circle for soft smoke look
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, currentSize);
        gradient.addColorStop(0, `hsla(${p.hue}, 60%, 55%, ${currentOpacity * 0.8})`);
        gradient.addColorStop(0.4, `hsla(${p.hue}, 50%, 45%, ${currentOpacity * 0.4})`);
        gradient.addColorStop(0.7, `hsla(${p.hue}, 40%, 35%, ${currentOpacity * 0.15})`);
        gradient.addColorStop(1, `hsla(${p.hue}, 30%, 25%, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, currentSize, 0, Math.PI * 2);
        ctx.fill();

        // Inner glow core
        if (progress < 0.4) {
          const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, currentSize * 0.3);
          coreGradient.addColorStop(0, `hsla(${p.hue + 20}, 80%, 75%, ${currentOpacity * 0.5})`);
          coreGradient.addColorStop(1, `hsla(${p.hue + 20}, 70%, 60%, 0)`);
          ctx.fillStyle = coreGradient;
          ctx.beginPath();
          ctx.arc(0, 0, currentSize * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      // Cap particle count to prevent memory issues
      if (particles.length > 300) {
        particles.splice(0, particles.length - 300);
      }
    };

    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', setSize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      particlesRef.current = [];
    };
  }, [createParticle]);

  return (
    <canvas
      ref={canvasRef}
      className="smoker-cursor-canvas"
      aria-hidden="true"
    />
  );
}
