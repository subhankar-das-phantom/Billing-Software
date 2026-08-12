import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { Effects } from '@react-three/drei';
import { UnrealBloomPass } from 'three-stdlib';
import * as THREE from 'three';

// Register UnrealBloomPass so <unrealBloomPass> works in JSX
extend({ UnrealBloomPass });

// ─── Milky Way Galaxy Scene ─────────────────────────
// A rotating barred spiral galaxy with a bright central bulge,
// sweeping spiral arms, and a thin stellar disk.
// Mouse interactivity: particles repel from cursor with glow effect.

function GalaxySwarm({ count }) {
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

  // Galaxy parameters
  const PARAMS = useMemo(() => ({
    radius: 150.4,
    arms: 4,
    twist: 4.5,
    spin: 0.12,
  }), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime() * speedMult;

    // Project mouse pointer into world space (on z=0 plane)
    mouseWorld.set(pointer.x, pointer.y, 0.5).unproject(camera);
    const dir = mouseWorld.sub(camera.position).normalize();
    const dist = -camera.position.z / dir.z;
    mouseWorld.copy(camera.position).add(dir.multiplyScalar(dist));

    // Mouse interaction params
    const mouseRadius = 60;
    const mouseStrength = 18;
    const mouseRadiusSq = mouseRadius * mouseRadius;

    const radius = PARAMS.radius;
    const arms = PARAMS.arms;
    const twist = PARAMS.twist;
    const spin = PARAMS.spin;
    const g = 2.399963229728653; // golden angle

    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) / count;

      // More stars concentrated near the galactic center
      const r = radius * Math.pow(u, 0.55);

      // Four major spiral arms
      const arm = (i % arms) / arms;
      const a = arm * 6.283185307179586 + r * twist * 0.055 + time * spin + i * g * 0.002;

      // Dense stellar bulge
      const bulge = 1.0 - u;
      const spread = bulge * bulge * radius * 0.12;

      // Spiral arm waviness
      const wave = Math.sin(r * 0.09 + a * 2.0);

      // Thin galactic disk
      const x = Math.cos(a) * (r + spread * wave);
      const z = Math.sin(a) * (r + spread * wave);
      const y = radius * 0.015 * bulge * Math.sin(a * 6.0 + time * 0.8);

      target.set(x, y, z);

      // ── Mouse interaction: repel particles away from cursor ──
      tempVec.copy(target).sub(mouseWorld);
      const distSq = tempVec.lengthSq();
      if (distSq < mouseRadiusSq && distSq > 0.01) {
        const falloff = 1.0 - (distSq / mouseRadiusSq);
        const force = mouseStrength * falloff * falloff;
        tempVec.normalize().multiplyScalar(force);
        target.add(tempVec);
      }

      // Warm yellow-white core fading to blue outer stars
      const core = Math.exp(-r / (radius * 0.18));
      const hue = 0.60 - 0.47 * core;
      const sat = 0.25 + 0.75 * (1.0 - core);
      let light = 0.45 + 0.5 * core;

      // Brighten particles near the mouse
      const glowBoost = (distSq < mouseRadiusSq) ? 0.15 * (1.0 - distSq / mouseRadiusSq) : 0;
      light = Math.min(light + glowBoost, 0.85);

      pColor.setHSL(hue, sat, light);

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
    const angle = time * 0.03;
    camera.position.x = Math.sin(angle) * radius;
    camera.position.y = 25; // tilt: view from above at ~30°
    camera.position.z = Math.cos(angle) * radius;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

// ─── Main Background Component (full-page fixed) ────
export default function ParticleSwarmBackground() {
  const count = useMemo(() => {
    if (typeof window === 'undefined') return 15000;
    const dpr = window.devicePixelRatio || 1;
    if (dpr >= 2) return 15000;
    return 20000;
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.4,
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
        <GalaxySwarm count={count} />
        <AutoRotate />
        <Effects disableGamma>
          <unrealBloomPass threshold={0} strength={0.5} radius={0.4} />
        </Effects>
      </Canvas>
    </div>
  );
}
