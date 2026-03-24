'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, KernelSize } from 'postprocessing';

// ─── Vertex Shader for Wave Mesh ───
const waveVertexShader = `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uMouseRadius;
  uniform float uLayerDepth;
  
  varying vec2 vUv;
  varying float vDistortion;
  
  void main() {
    vUv = uv;
    vec3 pos = position;
    
    // Multi-frequency wave displacement
    float wave1 = sin(pos.x * 1.5 + uTime * 0.4 + uLayerDepth) * 0.3;
    float wave2 = cos(pos.y * 2.0 + uTime * 0.3 + uLayerDepth * 1.5) * 0.2;
    float wave3 = sin(pos.x * 0.8 + pos.y * 1.2 + uTime * 0.5) * 0.15;
    float wave4 = cos(pos.x * 2.5 + uTime * 0.6 + uLayerDepth * 0.7) * 0.1;
    
    pos.z += (wave1 + wave2 + wave3 + wave4) * (0.8 + uLayerDepth * 0.3);
    
    // Cursor interaction — magnetic repulsion
    vec2 mouseOffset = pos.xy - uMouse;
    float mouseDist = length(mouseOffset);
    float influence = smoothstep(uMouseRadius, 0.0, mouseDist);
    vec2 push = normalize(mouseOffset + 0.001) * influence * 0.8;
    pos.xy += push;
    pos.z += influence * 0.5;
    
    vDistortion = (wave1 + wave2 + wave3) * 0.5 + influence * 2.0;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

// ─── Fragment Shader for Wave Mesh ───
const waveFragmentShader = `
  uniform float uTime;
  uniform float uLayerDepth;
  uniform float uOpacity;
  
  varying vec2 vUv;
  varying float vDistortion;
  
  void main() {
    // Purple → Violet → Blue gradient based on position + time
    float t = vUv.x * 0.6 + vUv.y * 0.4 + sin(uTime * 0.2) * 0.1;
    
    vec3 purple = vec3(0.55, 0.1, 0.85);
    vec3 violet = vec3(0.4, 0.05, 0.95);
    vec3 blue   = vec3(0.15, 0.2, 0.95);
    
    vec3 color;
    if (t < 0.5) {
      color = mix(purple, violet, t * 2.0);
    } else {
      color = mix(violet, blue, (t - 0.5) * 2.0);
    }
    
    // Glow intensity based on distortion
    float glow = 0.5 + abs(vDistortion) * 0.8;
    color *= glow;
    
    // Pulsing effect
    float pulse = 0.85 + sin(uTime * 0.8 + uLayerDepth * 2.0) * 0.15;
    color *= pulse;
    
    // Distance-based fade at edges
    float edgeFade = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x)
                   * smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
    
    gl_FragColor = vec4(color, edgeFade * uOpacity);
  }
`;

// ─── Particle Vertex Shader ───
const particleVertexShader = `
  uniform float uTime;
  uniform vec2 uMouse;
  
  attribute float aSize;
  attribute float aSpeed;
  attribute float aPhase;
  
  varying float vAlpha;
  
  void main() {
    vec3 pos = position;
    
    // Gentle floating motion
    pos.x += sin(uTime * aSpeed * 0.3 + aPhase) * 0.3;
    pos.y += cos(uTime * aSpeed * 0.2 + aPhase * 1.5) * 0.2;
    pos.z += sin(uTime * aSpeed * 0.15 + aPhase * 0.8) * 0.15;
    
    // Subtle cursor influence
    vec2 toMouse = pos.xy - uMouse;
    float dist = length(toMouse);
    float influence = smoothstep(3.0, 0.0, dist) * 0.3;
    pos.xy += normalize(toMouse + 0.001) * influence;
    
    vAlpha = 0.3 + sin(uTime * aSpeed + aPhase) * 0.2 + influence * 0.5;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (2.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// ─── Particle Fragment Shader ───
const particleFragmentShader = `
  varying float vAlpha;
  
  void main() {
    // Soft circular particle with glow
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    
    float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;
    vec3 color = mix(vec3(0.4, 0.1, 0.9), vec3(0.2, 0.3, 1.0), dist * 2.0);
    
    gl_FragColor = vec4(color * 1.5, alpha * 0.6);
  }
`;

export default function WaveMeshBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef(new THREE.Vector2(0, 0));
  const targetMouseRef = useRef(new THREE.Vector2(0, 0));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ─── Renderer Setup ───
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // ─── Scene & Camera ───
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.z = 5;

    // ─── Post-Processing (Bloom) ───
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloomEffect = new BloomEffect({
      intensity: 1.5,
      luminanceThreshold: 0.1,
      luminanceSmoothing: 0.9,
      kernelSize: KernelSize.MEDIUM,
      mipmapBlur: true,
    });
    composer.addPass(new EffectPass(camera, bloomEffect));

    // ─── Create Wave Mesh Layers ───
    const layers: {
      mesh: THREE.LineSegments;
      uniforms: Record<string, THREE.IUniform>;
    }[] = [];

    const layerConfigs = [
      { depth: 0.0, z: 0, opacity: 0.7, segments: 60, lineWidth: 1 },
      { depth: 1.0, z: -1.0, opacity: 0.45, segments: 45, lineWidth: 1 },
      { depth: 2.0, z: -2.0, opacity: 0.25, segments: 35, lineWidth: 1 },
    ];

    for (const config of layerConfigs) {
      const geometry = new THREE.BufferGeometry();
      const positions: number[] = [];
      const uvs: number[] = [];

      const gridSize = config.segments;
      const spread = 8;

      // Horizontal wave lines
      for (let i = 0; i <= gridSize; i++) {
        const y = (i / gridSize - 0.5) * spread;
        for (let j = 0; j < gridSize; j++) {
          const x1 = (j / gridSize - 0.5) * spread;
          const x2 = ((j + 1) / gridSize - 0.5) * spread;

          positions.push(x1, y, config.z);
          positions.push(x2, y, config.z);

          uvs.push(j / gridSize, i / gridSize);
          uvs.push((j + 1) / gridSize, i / gridSize);
        }
      }

      // Vertical wave lines (sparser for mesh effect)
      for (let j = 0; j <= gridSize; j += 3) {
        const x = (j / gridSize - 0.5) * spread;
        for (let i = 0; i < gridSize; i++) {
          const y1 = (i / gridSize - 0.5) * spread;
          const y2 = ((i + 1) / gridSize - 0.5) * spread;

          positions.push(x, y1, config.z);
          positions.push(x, y2, config.z);

          uvs.push(j / gridSize, i / gridSize);
          uvs.push(j / gridSize, (i + 1) / gridSize);
        }
      }

      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
      );
      geometry.setAttribute(
        'uv',
        new THREE.Float32BufferAttribute(uvs, 2)
      );

      const uniforms = {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uMouseRadius: { value: 2.0 },
        uLayerDepth: { value: config.depth },
        uOpacity: { value: config.opacity },
      };

      const material = new THREE.ShaderMaterial({
        vertexShader: waveVertexShader,
        fragmentShader: waveFragmentShader,
        uniforms,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const mesh = new THREE.LineSegments(geometry, material);
      scene.add(mesh);
      layers.push({ mesh, uniforms });
    }

    // ─── Floating Particles ───
    const particleCount = 200;
    const pPositions = new Float32Array(particleCount * 3);
    const pSizes = new Float32Array(particleCount);
    const pSpeeds = new Float32Array(particleCount);
    const pPhases = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      pPositions[i * 3] = (Math.random() - 0.5) * 10;
      pPositions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      pPositions[i * 3 + 2] = (Math.random() - 0.5) * 4 - 1;
      pSizes[i] = Math.random() * 15 + 3;
      pSpeeds[i] = Math.random() * 1.5 + 0.5;
      pPhases[i] = Math.random() * Math.PI * 2;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pPositions, 3));
    particleGeometry.setAttribute('aSize', new THREE.Float32BufferAttribute(pSizes, 1));
    particleGeometry.setAttribute('aSpeed', new THREE.Float32BufferAttribute(pSpeeds, 1));
    particleGeometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(pPhases, 1));

    const particleUniforms = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
    };

    const particleMaterial = new THREE.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      uniforms: particleUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // ─── Mouse Tracking ───
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize to world-space coordinates
      targetMouseRef.current.set(
        ((e.clientX / window.innerWidth) - 0.5) * 8,
        (-(e.clientY / window.innerHeight) + 0.5) * 6
      );
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        targetMouseRef.current.set(
          ((e.touches[0].clientX / window.innerWidth) - 0.5) * 8,
          (-(e.touches[0].clientY / window.innerHeight) + 0.5) * 6
        );
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    // ─── Resize Handler ───
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // ─── Animation Loop ───
    const clock = new THREE.Clock();
    let animationId: number;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Smooth mouse interpolation
      mouseRef.current.lerp(targetMouseRef.current, 0.05);

      // Update wave layers
      for (const layer of layers) {
        layer.uniforms.uTime.value = elapsed;
        layer.uniforms.uMouse.value.copy(mouseRef.current);
      }

      // Update particles
      particleUniforms.uTime.value = elapsed;
      particleUniforms.uMouse.value.copy(mouseRef.current);

      // Render with bloom
      composer.render();
    };

    animate();

    // ─── Cleanup ───
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('resize', handleResize);

      for (const layer of layers) {
        layer.mesh.geometry.dispose();
        (layer.mesh.material as THREE.ShaderMaterial).dispose();
        scene.remove(layer.mesh);
      }

      particleGeometry.dispose();
      particleMaterial.dispose();
      scene.remove(particles);

      composer.dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="wave-mesh-bg"
      aria-hidden="true"
    />
  );
}
