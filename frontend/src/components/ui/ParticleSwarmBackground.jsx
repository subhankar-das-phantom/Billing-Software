import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { Effects } from '@react-three/drei';
import { UnrealBloomPass } from 'three-stdlib';
import * as THREE from 'three';

// Register UnrealBloomPass so <unrealBloomPass> works in JSX
extend({ UnrealBloomPass });

// ─── Particle Swarm Scene ────────────────────────────
// Adapted from the tweet-sized p5.js "Yuruyurau Bloom" sketch.
// Colors remapped to the app's blue → cyan → teal → emerald palette.
// Mouse interactivity: particles are attracted/repelled by cursor position.

function ParticleSwarm({ count }) {
  const meshRef = useRef();
  const { camera, pointer } = useThree();
  const speedMult = 1;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const pColor = useMemo(() => new THREE.Color(), []);
  const mouseWorld = useMemo(() => new THREE.Vector3(), []);
  const tempVec = useMemo(() => new THREE.Vector3(), []);

  const positions = useMemo(() => {
    const pos = [];
    for (let i = 0; i < count; i++) {
      pos.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100
        )
      );
    }
    return pos;
  }, [count]);

  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffffff }), []);
  const geometry = useMemo(() => new THREE.TetrahedronGeometry(0.25), []);

  // Brand color stops: blue-500, cyan-400, teal-400, emerald-400
  const brandHues = useMemo(() => [
    217 / 360,  // blue-500   (#3b82f6)
    187 / 360,  // cyan-400   (#22d3ee)
    174 / 360,  // teal-400   (#2dd4bf)
    160 / 360,  // emerald-400 (#34d399)
  ], []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime() * speedMult;

    // Project mouse pointer into world space (on z=0 plane)
    mouseWorld.set(pointer.x, pointer.y, 0.5).unproject(camera);
    const dir = mouseWorld.sub(camera.position).normalize();
    const dist = -camera.position.z / dir.z;
    mouseWorld.copy(camera.position).add(dir.multiplyScalar(dist));

    const scale = 1.0;
    const speed = 0.3;
    const depth = 12;
    const glow = 0.3;
    const t = time * speed;

    // Mouse interaction params
    const mouseRadius = 60;        // influence radius in world units
    const mouseStrength = 18;      // max displacement force
    const mousRadiusSq = mouseRadius * mouseRadius;

    for (let i = 0; i < count; i++) {
      const y = (i / count) * 42.55;

      const k = (4.0 + Math.cos((i * (10000.0 / count)) / 9.0 - t * 2.0)) *
        Math.cos((i * (10000.0 / count)) / 35.0);
      const e = y / 7.0 - 13.0;
      const d = Math.sqrt(k * k + e * e) + Math.sin(e / 9.0 + t / 2.0) - 4.0;

      const q = 2.0 * Math.sin(k * 3.0) -
        (y / 35.0) * k * (9.0 + k * Math.sin(Math.cos(e) * 9.0 - d * 2.0 + t));
      const c = d - t;

      let px = (q + 40.0 * Math.cos(c)) * scale;
      let py = -((q * Math.sin(c) + d * 35.0) - 245.0) * scale;
      let pz = depth * Math.sin(k * 2.0 + c) * scale;

      target.set(px, py, pz);

      // ── Mouse interaction: repel particles away from cursor ──
      tempVec.copy(target).sub(mouseWorld);
      const distSq = tempVec.lengthSq();
      if (distSq < mousRadiusSq && distSq > 0.01) {
        const falloff = 1.0 - (distSq / mousRadiusSq);
        const force = mouseStrength * falloff * falloff; // quadratic falloff
        tempVec.normalize().multiplyScalar(force);
        target.add(tempVec);
      }

      // Remap original 360° hue → 4 brand color stops
      const hueDeg = ((d * 40.0 + time * 30.0) % 360.0 + 360.0) % 360.0;
      const normalized = hueDeg / 360.0;
      // Quantize into 4 brand hue bands
      const bandIndex = Math.floor(normalized * brandHues.length);
      const hue = brandHues[Math.min(bandIndex, brandHues.length - 1)];

      // Brighten particles near the mouse for a "glow on hover" effect
      const glowBoost = (distSq < mousRadiusSq) ? 0.15 * (1.0 - distSq / mousRadiusSq) : 0;
      pColor.setHSL(hue, 0.85, Math.min(glow + glowBoost, 0.5));

      positions[i].lerp(target, 0.1);
      dummy.position.copy(positions[i]);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, pColor);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, count]} />
  );
}

// ─── Slow auto-rotation without OrbitControls ────────
// OrbitControls intercepts pointer events which blocks scrolling/clicking.
// Instead, gently rotate the camera programmatically.
function AutoRotate() {
  const { camera } = useThree();
  const radius = 100;

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const angle = time * 0.03; // very slow rotation
    camera.position.x = Math.sin(angle) * radius;
    camera.position.z = Math.cos(angle) * radius;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

// ─── Main Background Component (full-page fixed) ────
export default function ParticleSwarmBackground() {
  // Adaptive particle count based on GPU capability
  const count = useMemo(() => {
    if (typeof window === 'undefined') return 15000;
    const dpr = window.devicePixelRatio || 1;
    if (dpr >= 2) return 15000;  // Retina / HiDPI
    return 20000;                 // Standard 1080p
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.4,  // let clicks pass through to page content
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 100], fov: 60 }}
        dpr={Math.min(window.devicePixelRatio || 1, 1.5)}
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent', pointerEvents: 'auto' }}
        eventSource={document.body}
        eventPrefix="client"
      >
        <fog attach="fog" args={['#000000', 80, 250]} />
        <ParticleSwarm count={count} />
        <AutoRotate />
        <Effects disableGamma>
          <unrealBloomPass threshold={0} strength={0.5} radius={0.4} />
        </Effects>
      </Canvas>
    </div>
  );
}
