import { useRef, useMemo, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { Effects } from '@react-three/drei';
import { UnrealBloomPass } from 'three-stdlib';
import * as THREE from 'three';

// Register UnrealBloomPass so <unrealBloomPass> works in JSX
extend({ UnrealBloomPass });

// ═══════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════

const TWO_PI = 6.283185307179586;
const GOLDEN_ANGLE = 2.399963229728653;
const VELOCITY_REFERENCE = 2.0;
const VELOCITY_DEADBAND = 0.03;
const GALAXY_RADIUS = 150.4;

// ═══════════════════════════════════════════════════════
//  Math Utilities
// ═══════════════════════════════════════════════════════

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function easeInOut(t) {
  return smoothstep(clamp(t, 0, 1));
}

function easeOut(t) {
  const ct = clamp(t, 0, 1);
  return 1 - (1 - ct) * (1 - ct);
}

// ═══════════════════════════════════════════════════════
//  Frame-Rate Independent Damping
//  Uses exponential decay: consistent at 30/60/120/144 FPS
// ═══════════════════════════════════════════════════════

function dampValue(current, target, smoothing, delta) {
  return current + (target - current) * (1 - Math.exp(-smoothing * delta));
}

// Damp a THREE.Vector3 toward (tx, ty, tz) in-place — zero allocation
function dampVec3(vec, tx, ty, tz, smoothing, delta) {
  const f = 1 - Math.exp(-smoothing * delta);
  vec.x += (tx - vec.x) * f;
  vec.y += (ty - vec.y) * f;
  vec.z += (tz - vec.z) * f;
}

// ═══════════════════════════════════════════════════════
//  Unified Keyframe Timeline
//  All visual properties in one array, one interpolation
//  system handles everything. Named phases are comments only.
// ═══════════════════════════════════════════════════════

const GALAXY_KEYFRAMES = [
  {
    // Phase 0 — Hero: high overhead, mysterious
    at: 0.00,
    camera: { position: [0, 40, 100], target: [0, 0, 0], fov: 60 },
    spread: 1.0, twist: 4.5, thickness: 1.0, spin: 0.12, hyperspace: 0.0,
    coreHue: 0.13, coreSat: 0.25, coreBright: 0.85,
    outerHue: 0.60, outerSat: 0.80, outerBright: 0.45,
    bloomStrength: 0.5, fogNear: 80, fogFar: 250, opacity: 0.40,
  },
  {
    // Phase 1 — Features: Sweep to far high left
    at: 0.20,
    camera: { position: [-60, 45, 60], target: [0, 0, 0], fov: 55 },
    spread: 1.1, twist: 4.2, thickness: 1.2, spin: 0.15, hyperspace: 0.0,
    coreHue: 0.15, coreSat: 0.30, coreBright: 0.90,
    outerHue: 0.52, outerSat: 0.75, outerBright: 0.50,
    bloomStrength: 0.6, fogNear: 65, fogFar: 220, opacity: 0.48,
  },
  {
    // Phase 2 — Dive: Pan majestically across the left mid-ground
    at: 0.40,
    camera: { position: [-25, 40, 75], target: [0, 0, 0], fov: 60 },
    spread: 1.2, twist: 3.8, thickness: 1.4, spin: 0.18, hyperspace: 0.0,
    coreHue: 0.12, coreSat: 0.20, coreBright: 0.95,
    outerHue: 0.48, outerSat: 0.70, outerBright: 0.55,
    bloomStrength: 0.8, fogNear: 35, fogFar: 150, opacity: 0.55,
  },
  {
    // Phase 3 — Emerge: Cross the center to the right mid-ground
    at: 0.60,
    camera: { position: [25, 40, 75], target: [0, 0, 0], fov: 55 },
    spread: 1.1, twist: 4.0, thickness: 1.2, spin: 0.15, hyperspace: 0.0,
    coreHue: 0.10, coreSat: 0.25, coreBright: 0.90,
    outerHue: 0.38, outerSat: 0.70, outerBright: 0.50,
    bloomStrength: 0.7, fogNear: 55, fogFar: 200, opacity: 0.45,
  },
  {
    // Phase 4 — Converge: Sweep to far high right
    at: 0.80,
    camera: { position: [60, 45, 60], target: [0, 0, 0], fov: 50 },
    spread: 1.0, twist: 4.2, thickness: 1.0, spin: 0.12, hyperspace: 0.0,
    coreHue: 0.08, coreSat: 0.35, coreBright: 0.95,
    outerHue: 0.10, outerSat: 0.75, outerBright: 0.55,
    bloomStrength: 1.0, fogNear: 60, fogFar: 200, opacity: 0.38,
  },
  {
    // Hold final state through scroll end (settle back in center)
    at: 1.00,
    camera: { position: [0, 35, 90], target: [0, 0, 0], fov: 50 },
    spread: 1.2, twist: 4.0, thickness: 1.0, spin: 0.08, hyperspace: 0.0,
    coreHue: 0.08, coreSat: 0.35, coreBright: 0.95,
    outerHue: 0.10, outerSat: 0.75, outerBright: 0.55,
    bloomStrength: 1.0, fogNear: 60, fogFar: 200, opacity: 0.38,
  },
];

// ═══════════════════════════════════════════════════════
//  Timeline Interpolation
//  Continuous by construction — no phase detection logic
// ═══════════════════════════════════════════════════════

function getKeyframeIndex(scroll, keyframes) {
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (scroll <= keyframes[i + 1].at) return i;
  }
  return keyframes.length - 2;
}

function getTimelineT(scroll, keyframes, index) {
  const a = keyframes[index].at;
  const b = keyframes[index + 1].at;
  return b > a ? (scroll - a) / (b - a) : 0;
}

// ═══════════════════════════════════════════════════════
//  Pure State Generation
//  Numbers in, numbers out. No Three.js knowledge.
//  Writes into a caller-provided object (zero allocation).
// ═══════════════════════════════════════════════════════

// Reusable output — allocated once at module scope
const _state = {
  cameraPosition: [0, 30, 100],
  cameraTarget: [0, 0, 0],
  cameraFov: 60,
  spread: 1.0, twist: 4.5, thickness: 1.0, spin: 0.12, hyperspace: 0.0,
  coreHue: 0.13, coreSat: 0.25, coreBright: 0.85,
  outerHue: 0.60, outerSat: 0.80, outerBright: 0.45,
  bloomStrength: 0.5, fogNear: 80, fogFar: 250, opacity: 0.40,
  speedFactor: 0, driftDirection: 0,
};

function getGalaxyState(scroll, velocity, out) {
  const i = getKeyframeIndex(scroll, GALAXY_KEYFRAMES);
  const t = getTimelineT(scroll, GALAXY_KEYFRAMES, i);
  const kA = GALAXY_KEYFRAMES[i];
  const kB = GALAXY_KEYFRAMES[i + 1];

  // Velocity-derived intensities (after deadband)
  const speed = Math.max(0, Math.abs(velocity) - VELOCITY_DEADBAND);
  const direction = Math.sign(velocity);

  // Per-property easing
  const tEIO = easeInOut(t);
  const tEO = easeOut(t);

  // ── Camera ──
  // FOV uses a slightly leading timeline (+0.02 scroll ahead)
  // so FOV starts changing before the camera moves and settles after
  const fovScroll = clamp(scroll + 0.02, 0, 1);
  const fi = getKeyframeIndex(fovScroll, GALAXY_KEYFRAMES);
  const ft = getTimelineT(fovScroll, GALAXY_KEYFRAMES, fi);
  const fA = GALAXY_KEYFRAMES[fi];
  const fB = GALAXY_KEYFRAMES[fi + 1];

  out.cameraPosition[0] = lerp(kA.camera.position[0], kB.camera.position[0], tEIO);
  out.cameraPosition[1] = lerp(kA.camera.position[1], kB.camera.position[1], tEIO);
  out.cameraPosition[2] = lerp(kA.camera.position[2], kB.camera.position[2], tEIO);
  out.cameraTarget[0] = lerp(kA.camera.target[0], kB.camera.target[0], tEIO);
  out.cameraTarget[1] = lerp(kA.camera.target[1], kB.camera.target[1], tEIO);
  out.cameraTarget[2] = lerp(kA.camera.target[2], kB.camera.target[2], tEIO);
  out.cameraFov = lerp(fA.camera.fov, fB.camera.fov, easeInOut(ft));

  // ── Galaxy morphology ──
  out.spread = lerp(kA.spread, kB.spread, tEO);
  out.twist = lerp(kA.twist, kB.twist, tEIO);
  out.thickness = lerp(kA.thickness, kB.thickness, tEO);
  // Reduced speed multiplier from 0.04 to 0.015 so it doesn't spin out of control
  out.spin = lerp(kA.spin, kB.spin, tEIO) + speed * 0.015;
  // Reduced hyperspace boost from 0.5 to 0.15
  out.hyperspace = lerp(kA.hyperspace, kB.hyperspace, tEIO) * (1 + speed * 0.15);

  // ── Color (near-linear for smooth transition) ──
  out.coreHue = lerp(kA.coreHue, kB.coreHue, t);
  out.coreSat = lerp(kA.coreSat, kB.coreSat, t);
  out.coreBright = lerp(kA.coreBright, kB.coreBright, t);
  out.outerHue = lerp(kA.outerHue, kB.outerHue, t);
  out.outerSat = lerp(kA.outerSat, kB.outerSat, t);
  out.outerBright = lerp(kA.outerBright, kB.outerBright, t);

  // ── Atmosphere ──
  out.bloomStrength = lerp(kA.bloomStrength, kB.bloomStrength, tEO);
  out.fogNear = lerp(kA.fogNear, kB.fogNear, tEIO);
  out.fogFar = lerp(kA.fogFar, kB.fogFar, tEIO);
  out.opacity = lerp(kA.opacity, kB.opacity, tEIO);

  // ── Velocity-derived (secondary effects only) ──
  out.speedFactor = speed;
  out.driftDirection = direction;
}

// ═══════════════════════════════════════════════════════
//  Galaxy Controller
//  Owns all Three.js interaction: camera, particles,
//  atmosphere. Reads pure state, damps, and applies.
// ═══════════════════════════════════════════════════════

function GalaxyController({ scrollRef, velocityRef, count, containerRef }) {
  const { camera, scene, pointer } = useThree();
  const meshRef = useRef();
  const bloomRef = useRef();

  // ── Pre-allocated reusable objects (created once) ──
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const pColor = useMemo(() => new THREE.Color(), []);
  const mouseWorld = useMemo(() => new THREE.Vector3(), []);
  const tempVec = useMemo(() => new THREE.Vector3(), []);
  const cameraForward = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const rayDir = useMemo(() => new THREE.Vector3(), []);

  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffffff }), []);
  const geometry = useMemo(() => new THREE.TetrahedronGeometry(0.25), []);

  // ── Precomputed per-particle data (expensive math done once) ──
  const particleData = useMemo(() => {
    const powU = new Float32Array(count);
    const coreF = new Float32Array(count);
    const hsPhase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      powU[i] = Math.pow((i + 0.5) / count, 0.55);
      // Core factor: exp(-u^0.55 / 0.18)
      // Independent of spread — color distribution stays proportional
      coreF[i] = Math.exp(-powU[i] / 0.18);
      // Hyperspace phase per-particle (for varied drift)
      hsPhase[i] = (i * GOLDEN_ANGLE) % TWO_PI;
    }
    return { poweredU: powU, coreFactors: coreF, hyperspacePhase: hsPhase };
  }, [count]);

  // Accumulated elapsed time — avoids deprecated THREE.Clock
  const elapsedRef = useRef(0);

  // ── Damped state (mutable, persists across frames, no re-renders) ──
  const d = useRef({
    // Camera
    camPosX: 0, camPosY: 30, camPosZ: 100,
    camTgtX: 0, camTgtY: 0, camTgtZ: 0,
    fov: 60,
    // Galaxy
    spread: 1.0, twist: 4.5, thickness: 1.0, spin: 0.12, hyperspace: 0.0,
    // Color
    coreHue: 0.13, coreSat: 0.25, coreBright: 0.85,
    outerHue: 0.60, outerSat: 0.80, outerBright: 0.45,
    // Atmosphere
    bloomStrength: 0.5, fogNear: 80, fogFar: 250, opacity: 0.40,
    // Velocity
    smoothVelocity: 0,
    // Phase Integration
    accumulatedSpin: 0,
  }).current; // .current so we get the plain object, not the ref wrapper

  // ── Main render loop ──
  useFrame((state) => {
    if (!meshRef.current) return;
    // Cap delta for tab-switch recovery (prevents huge jumps)
    const delta = Math.min(state.delta || 0.016, 0.1);
    // Accumulate elapsed time from delta (avoids THREE.Clock deprecation)
    elapsedRef.current += delta;
    // Autonomous time — always ticking, keeps galaxy alive when scroll stops
    const autoTime = elapsedRef.current * 0.3;

    // Properly integrate spin so changing speeds doesn't cause timeline jumps!
    d.accumulatedSpin += d.spin * delta;

    // ────────────────────────────────────────
    // 1. Velocity smoothing
    // ────────────────────────────────────────
    // Defend against missing refs during HMR or NaN values
    const s = (scrollRef && typeof scrollRef.current === 'number' && !isNaN(scrollRef.current)) ? scrollRef.current : 0;
    const v = (velocityRef && typeof velocityRef.current === 'number' && !isNaN(velocityRef.current)) ? velocityRef.current : 0;

    const rawNorm = clamp(v / VELOCITY_REFERENCE, -1, 1);
    d.smoothVelocity = dampValue(d.smoothVelocity, rawNorm, 6, delta);

    // ────────────────────────────────────────
    // 2. Compute desired state (pure function)
    // ────────────────────────────────────────
    getGalaxyState(s, d.smoothVelocity, _state);

    // ────────────────────────────────────────
    // 3. Damp all properties toward desired state
    // ────────────────────────────────────────

    // Camera position + target (smoothing 5)
    d.camPosX = dampValue(d.camPosX, _state.cameraPosition[0], 5, delta);
    d.camPosY = dampValue(d.camPosY, _state.cameraPosition[1], 5, delta);
    d.camPosZ = dampValue(d.camPosZ, _state.cameraPosition[2], 5, delta);
    d.camTgtX = dampValue(d.camTgtX, _state.cameraTarget[0], 5, delta);
    d.camTgtY = dampValue(d.camTgtY, _state.cameraTarget[1], 5, delta);
    d.camTgtZ = dampValue(d.camTgtZ, _state.cameraTarget[2], 5, delta);
    // FOV (smoothing 3 — slower, more cinematic)
    d.fov = dampValue(d.fov, _state.cameraFov, 3, delta);

    // Galaxy morphology (smoothing 3)
    d.spread = dampValue(d.spread, _state.spread, 3, delta);
    d.twist = dampValue(d.twist, _state.twist, 3, delta);
    d.thickness = dampValue(d.thickness, _state.thickness, 3, delta);
    d.spin = dampValue(d.spin, _state.spin, 3, delta);
    // Hyperspace (smoothing 4)
    d.hyperspace = dampValue(d.hyperspace, _state.hyperspace, 4, delta);

    // Color (smoothing 4)
    d.coreHue = dampValue(d.coreHue, _state.coreHue, 4, delta);
    d.coreSat = dampValue(d.coreSat, _state.coreSat, 4, delta);
    d.coreBright = dampValue(d.coreBright, _state.coreBright, 4, delta);
    d.outerHue = dampValue(d.outerHue, _state.outerHue, 4, delta);
    d.outerSat = dampValue(d.outerSat, _state.outerSat, 4, delta);
    d.outerBright = dampValue(d.outerBright, _state.outerBright, 4, delta);

    // Atmosphere (smoothing 3)
    d.bloomStrength = dampValue(d.bloomStrength, _state.bloomStrength, 3, delta);
    d.fogNear = dampValue(d.fogNear, _state.fogNear, 3, delta);
    d.fogFar = dampValue(d.fogFar, _state.fogFar, 3, delta);
    d.opacity = dampValue(d.opacity, _state.opacity, 4, delta);

    // ────────────────────────────────────────
    // 4. Apply camera
    // ────────────────────────────────────────
    camera.position.set(d.camPosX, d.camPosY, d.camPosZ);
    lookTarget.set(d.camTgtX, d.camTgtY, d.camTgtZ);
    camera.lookAt(lookTarget);
    camera.fov = d.fov;
    camera.updateProjectionMatrix();

    // ────────────────────────────────────────
    // 5. Apply atmosphere (property mutation, no reconstruction)
    // ────────────────────────────────────────
    if (scene.fog) {
      scene.fog.near = d.fogNear;
      scene.fog.far = d.fogFar;
    }
    if (bloomRef.current) {
      bloomRef.current.strength = d.bloomStrength;
    }
    // Container opacity (direct DOM mutation, no React re-render)
    if (containerRef.current) {
      containerRef.current.style.opacity = d.opacity;
    }

    // ────────────────────────────────────────
    // 6. Camera forward direction (for hyperspace + mouse)
    // ────────────────────────────────────────
    const dx = d.camTgtX - d.camPosX;
    const dy = d.camTgtY - d.camPosY;
    const dz = d.camTgtZ - d.camPosZ;
    const viewDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (viewDist > 0.001) {
      cameraForward.set(dx / viewDist, dy / viewDist, dz / viewDist);
    }

    // ────────────────────────────────────────
    // 7. Mouse world projection
    //    Projects pointer onto plane through lookTarget,
    //    perpendicular to camera forward direction.
    //    Works correctly at all camera orientations.
    // ────────────────────────────────────────
    mouseWorld.set(pointer.x, pointer.y, 0.5).unproject(camera);
    rayDir.copy(mouseWorld).sub(camera.position).normalize();
    const denom = rayDir.dot(cameraForward);
    if (Math.abs(denom) > 0.001 && viewDist > 0.001) {
      const rayDist = viewDist / denom;
      if (rayDist > 0) {
        mouseWorld.copy(camera.position).addScaledVector(rayDir, rayDist);
      } else {
        // Ray going away from plane — park mouse out of range
        mouseWorld.set(9999, 9999, 9999);
      }
    } else {
      mouseWorld.set(9999, 9999, 9999);
    }

    const mouseRadius = 200;
    const mouseStrength = 25;
    const mouseRadiusSq = mouseRadius * mouseRadius;

    // ────────────────────────────────────────
    // 8. Particle loop
    //    All positions are procedural (non-destructive).
    //    Hyperspace is an additive overlay.
    //    Galaxy params are already damped — no per-particle lerp needed.
    // ────────────────────────────────────────
    const radius = GALAXY_RADIUS;
    const spread = d.spread;
    const twist = d.twist;
    const thickness = d.thickness;
    const spin = d.spin;
    const hyperspace = d.hyperspace;
    const speedFactor = _state.speedFactor;

    const { poweredU, coreFactors, hyperspacePhase } = particleData;

    for (let i = 0; i < count; i++) {
      // ── Base galaxy position (procedural, source of truth) ──
      const pU = poweredU[i];
      const r = radius * pU * spread;

      // Spiral arms with hyperspace scatter (in formula, not coordinates)
      const armIndex = i % 4;
      const armBase = (armIndex / 4) * TWO_PI;
      const armScatter = (GOLDEN_ANGLE * i * 0.1) * hyperspace * 0.6;
      const armAngle = (armBase * (1 - hyperspace * 0.6) + armScatter)
        + r * twist * 0.055
        + d.accumulatedSpin
        + i * GOLDEN_ANGLE * 0.002;

      const bulge = 1.0 - pU;
      const wave = Math.sin(r * 0.09 + armAngle * 2.0);
      const armWidth = bulge * bulge * radius * 0.12;

      const baseX = Math.cos(armAngle) * (r + armWidth * wave);
      const baseZ = Math.sin(armAngle) * (r + armWidth * wave);
      const baseY = radius * 0.015 * thickness * bulge
        * Math.sin(armAngle * 6.0 + autoTime * 0.8);

      // ── Hyperspace overlay (additive, reversible) ──
      let hx = 0, hy = 0, hz = 0;
      if (hyperspace > 0.001) {
        const phase = hyperspacePhase[i];
        // Outward radial pulse instead of camera-relative drift to prevent
        // violent swinging/distortion when the camera pans during scroll
        const radialDrift = Math.sin(phase + autoTime * 3.0) * hyperspace * 8.0;
        const depthBoost = Math.sin(phase * 3.0 + autoTime) * hyperspace * 2.5 * radius * 0.015;

        hx = Math.cos(armAngle) * radialDrift;
        hz = Math.sin(armAngle) * radialDrift;
        hy = depthBoost;
      }

      target.set(baseX + hx, baseY + hy, baseZ + hz);

      // ── Mouse repulsion ──
      const mdx = target.x - mouseWorld.x;
      const mdy = target.y - mouseWorld.y;
      const mdz = target.z - mouseWorld.z;
      const mdSq = mdx * mdx + mdy * mdy + mdz * mdz;
      if (mdSq < mouseRadiusSq && mdSq > 0.1) {
        const md = Math.sqrt(mdSq);
        const falloff = Math.pow(1 - md / mouseRadius, 2.0);
        
        // Gentle outward push to prevent hole-tearing
        const repelForce = mouseStrength * 0.15 * falloff;
        // Strong tangential swirl to create a massive fluid effect without destroying density
        const swirlForce = mouseStrength * 0.85 * falloff;
        
        hx += (mdx / md) * repelForce + (mdz / md) * swirlForce;
        hy += (mdy / md) * repelForce * 0.2;
        hz += (mdz / md) * repelForce - (mdx / md) * swirlForce;
      }

      target.set(baseX + hx, baseY + hy, baseZ + hz);

      // ── Color (dual core/outer model) ──
      const core = coreFactors[i];
      const hue = d.outerHue + (d.coreHue - d.outerHue) * core;
      const sat = d.outerSat + (d.coreSat - d.outerSat) * core;
      let light = d.outerBright + (d.coreBright - d.outerBright) * core;

      // Velocity brightness accent (during hyperspace, forward-facing particles)
      if (speedFactor > 0 && hyperspace > 0.001) {
        light = Math.min(light + speedFactor * 0.15 * hyperspace, 0.95);
      }

      // Mouse glow boost
      if (mdSq < mouseRadiusSq) {
        light = Math.min(light + 0.15 * (1.0 - mdSq / mouseRadiusSq), 0.95);
      }

      pColor.setHSL(hue, sat, light);

      // ── Write to instance buffers ──
      dummy.position.copy(target);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, pColor);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[geometry, material, count]} />
      <Effects disableGamma>
        <unrealBloomPass ref={bloomRef} threshold={0} strength={0.5} radius={0.4} />
      </Effects>
    </>
  );
}

// ═══════════════════════════════════════════════════════
//  Main Background Component
//  Fixed full-page container with adaptive particle count.
//  Accepts scroll/velocity refs from LandingPage.
// ═══════════════════════════════════════════════════════

export default function ParticleSwarmBackground({ scrollRef, velocityRef }) {
  const containerRef = useRef(null);
  const [contextLost, setContextLost] = useState(false);

  const count = useMemo(() => {
    if (typeof window === 'undefined') return 15000;
    const dpr = window.devicePixelRatio || 1;
    return dpr >= 2 ? 15000 : 20000;
  }, []);

  // Resolve DPR and event source safely (SPA-only, no SSR)
  const dpr = useMemo(
    () => Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.5),
    []
  );
  const eventSource = useMemo(
    () => (typeof document !== 'undefined' ? document.body : undefined),
    []
  );

  // Handle WebGL context loss/restore gracefully
  const handleCreated = useCallback(({ gl }) => {
    const canvas = gl.domElement;

    const onContextLost = (event) => {
      event.preventDefault(); // Signal to browser we want to recover
      console.warn('[ParticleSwarmBackground] WebGL context lost — hiding canvas');
      setContextLost(true);
    };

    const onContextRestored = () => {
      console.log('[ParticleSwarmBackground] WebGL context restored — showing canvas');
      setContextLost(false);
    };

    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: contextLost ? 0 : 0.4, // Hide on context loss, GalaxyController updates otherwise
        transition: contextLost ? 'opacity 0.3s ease-out' : 'none',
      }}
    >
      <Canvas
        camera={{ position: [0, 30, 100], fov: 60, near: 0.5, far: 500 }}
        dpr={dpr}
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent', pointerEvents: 'auto' }}
        eventSource={eventSource}
        eventPrefix="client"
        onCreated={handleCreated}
      >
        <fog attach="fog" args={['#000000', 80, 250]} />
        <GalaxyController
          scrollRef={scrollRef}
          velocityRef={velocityRef}
          count={count}
          containerRef={containerRef}
        />
      </Canvas>
    </div>
  );
}

