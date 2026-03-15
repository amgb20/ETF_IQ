import { useEffect, useRef } from "react";
import * as THREE from "three";
import { generateContinentDots } from "./continent-dots";

const GOLD_GLOW = 0xd4a843;
const GLOBE_RADIUS = 2.2;
const DOT_COUNT = 12000;

function latLonToVec3(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  );
}

export function GlobeCanvas({ className }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // ── Renderer ──────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // ── Scene & Camera ────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(-1.2, 0.6, 6.0);
    camera.lookAt(-0.2, -0.1, 0);

    // ── Globe pivot (rotates) ──────────────────────────────────
    const globePivot = new THREE.Group();
    globePivot.rotation.x = THREE.MathUtils.degToRad(12);
    scene.add(globePivot);

    // ── Continent dots — explicit GOLD color ─────────────────
    const dots = generateContinentDots(DOT_COUNT);
    const positions = new Float32Array(dots.length * 3);
    const colors = new Float32Array(dots.length * 3);

    dots.forEach(({ lat, lon, brightness }, i) => {
      const v = latLonToVec3(lat, lon, GLOBE_RADIUS);
      positions[i * 3]     = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;

      // Explicit gold RGB with brightness variation
      const t = 0.5 + brightness * 0.5;
      colors[i * 3]     = 0.82 * t;  // R — strong
      colors[i * 3 + 1] = 0.66 * t;  // G — warm
      colors[i * 3 + 2] = 0.22 * t;  // B — low for gold
    });

    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    dotGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const dotMat = new THREE.PointsMaterial({
      size: 0.025,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      sizeAttenuation: true,
    });

    const dotMesh = new THREE.Points(dotGeo, dotMat);
    globePivot.add(dotMesh);

    // ── Dark sphere base (occludes dots on far side) ───────────
    const sphereGeo = new THREE.SphereGeometry(GLOBE_RADIUS - 0.01, 64, 64);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x050608,
      transparent: true,
      opacity: 0.96,
    });
    globePivot.add(new THREE.Mesh(sphereGeo, sphereMat));

    // ── Atmosphere (rim glow) — Gold Fresnel ─────────────────
    const atmGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.08, 64, 64);
    const atmMat = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(GOLD_GLOW) },
        viewVector: { value: camera.position },
        c: { value: 0.35 },
        p: { value: 5.0 },
      },
      vertexShader: /* glsl */ `
        uniform vec3 viewVector;
        uniform float c;
        uniform float p;
        varying float intensity;
        void main() {
          vec3 vNormal = normalize(normalMatrix * normal);
          vec3 vNormel = normalize(normalMatrix * viewVector);
          intensity = pow(c - dot(vNormal, vNormel), p);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 glowColor;
        varying float intensity;
        void main() {
          vec3 glow = glowColor * intensity;
          gl_FragColor = vec4(glow, intensity * 0.85);
        }
      `,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const atmMesh = new THREE.Mesh(atmGeo, atmMat);
    scene.add(atmMesh);

    // ── Resize helper ─────────────────────────────────────────
    function resize() {
      const w = container!.clientWidth;
      const h = container!.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      (atmMat.uniforms.viewVector as THREE.IUniform<THREE.Vector3>).value.copy(camera.position);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // ── Animation loop ────────────────────────────────────────
    let animId = 0;
    const RPM = 1 / 75;
    const clock = new THREE.Clock();

    function animate() {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      globePivot.rotation.y += delta * RPM * Math.PI * 2;
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      renderer.dispose();
      dotGeo.dispose();
      dotMat.dispose();
      sphereGeo.dispose();
      sphereMat.dispose();
      atmGeo.dispose();
      atmMat.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className={className} style={{ background: "transparent" }} />;
}
