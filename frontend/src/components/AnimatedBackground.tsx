'use client';

import { useEffect, useRef } from 'react';

export default function AnimatedBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Dynamically load Three.js from CDN
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js';
    script.async = true;

    script.onload = () => {
      const THREE = (window as unknown as Record<string, unknown>).THREE as typeof import('three');
      if (!THREE) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        1,
        1000
      );
      camera.position.z = 200;

      const renderer = new THREE.WebGLRenderer({ alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      // PARTICLES
      const particlesCount = 2000;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particlesCount * 3);

      for (let i = 0; i < particlesCount * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 600;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const material = new THREE.PointsMaterial({
        size: 2,
        color: 0x3399ff,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      // MOUSE INTERACTION
      let mouseX = 0;
      let mouseY = 0;

      const handleMouseMove = (e: MouseEvent) => {
        mouseX = (e.clientX - window.innerWidth / 2) * 0.05;
        mouseY = (e.clientY - window.innerHeight / 2) * 0.05;
      };

      // TOUCH INTERACTION (mobile support)
      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length > 0) {
          mouseX = (e.touches[0].clientX - window.innerWidth / 2) * 0.05;
          mouseY = (e.touches[0].clientY - window.innerHeight / 2) * 0.05;
        }
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('touchmove', handleTouchMove, { passive: true });

      // ANIMATION
      let animFrameId: number;

      function animate() {
        animFrameId = requestAnimationFrame(animate);

        particles.rotation.y += 0.0008;
        particles.rotation.x += 0.0003;

        // magnetic cursor effect
        particles.position.x += (mouseX - particles.position.x) * 0.02;
        particles.position.y += (-mouseY - particles.position.y) * 0.02;

        renderer.render(scene, camera);
      }

      animate();

      // RESPONSIVE
      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };

      window.addEventListener('resize', handleResize);

      // Store cleanup function
      cleanupRef.current = () => {
        cancelAnimationFrame(animFrameId);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('resize', handleResize);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      };
    };

    document.head.appendChild(script);

    return () => {
      // Clean up Three.js resources
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      // Remove script tag
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
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
        background: 'radial-gradient(circle at center, #020617, #000)',
        pointerEvents: 'none',
      }}
    >
      {/* glow + depth overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 30% 30%, rgba(0,150,255,0.15), transparent 40%), radial-gradient(circle at 70% 70%, rgba(0,100,255,0.1), transparent 50%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        #insane-bg canvas,
        [data-particle-bg] canvas {
          position: absolute;
          width: 100%;
          height: 100%;
          filter: brightness(1.3) contrast(1.1);
        }
      `}} />
    </div>
  );
}
