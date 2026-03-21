import React, { useRef, useMemo } from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { GOLD, CHART_COLORS } from "../design-tokens";

const AGENTS = [
  { name: "Macro", color: CHART_COLORS[0], targetPos: [4, 1, 0] as [number, number, number], icon: "Globe" },
  { name: "Sector", color: CHART_COLORS[1], targetPos: [-4, 1, 0] as [number, number, number], icon: "Chart" },
  { name: "Risk", color: CHART_COLORS[2], targetPos: [0, 1, 4] as [number, number, number], icon: "Shield" },
  { name: "Recommender", color: CHART_COLORS[4], targetPos: [0, 1, -4] as [number, number, number], icon: "Lightbulb" },
];

const CentralNode: React.FC<{ pulseProgress: number }> = ({ pulseProgress }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const scale = 0.6 + Math.sin(pulseProgress * Math.PI * 2) * 0.08;

  return (
    <group>
      <mesh ref={meshRef} scale={[scale, scale, scale]}>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial
          color={GOLD}
          emissive={GOLD}
          emissiveIntensity={0.6}
          roughness={0.3}
          metalness={0.8}
        />
      </mesh>
      <mesh scale={[scale * 1.4, scale * 1.4, scale * 1.4]}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial
          color={GOLD}
          transparent
          opacity={0.12}
          side={THREE.BackSide}
        />
      </mesh>
      <pointLight position={[0, 0, 0]} color={GOLD} intensity={3} distance={12} />
    </group>
  );
};

const AgentOrb: React.FC<{
  color: string;
  startPos: [number, number, number];
  targetPos: [number, number, number];
  launchProgress: number;
  returnProgress: number;
  collectingProgress: number;
}> = ({ color, startPos, targetPos, launchProgress, returnProgress, collectingProgress }) => {
  const x = interpolate(
    returnProgress > 0 ? returnProgress : launchProgress,
    [0, 1],
    returnProgress > 0 ? [targetPos[0], startPos[0]] : [startPos[0], targetPos[0]]
  );
  const y = interpolate(
    returnProgress > 0 ? returnProgress : launchProgress,
    [0, 1],
    returnProgress > 0 ? [targetPos[1], startPos[1]] : [startPos[1], targetPos[1]]
  );
  const z = interpolate(
    returnProgress > 0 ? returnProgress : launchProgress,
    [0, 1],
    returnProgress > 0 ? [targetPos[2], startPos[2]] : [startPos[2], targetPos[2]]
  );

  const arcY = y + Math.sin((returnProgress > 0 ? returnProgress : launchProgress) * Math.PI) * 1.5;
  const collectPulse = 1 + (collectingProgress > 0 ? Math.sin(collectingProgress * Math.PI * 4) * 0.15 : 0);

  return (
    <group position={[x, arcY, z]}>
      <mesh scale={[0.3 * collectPulse, 0.3 * collectPulse, 0.3 * collectPulse]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          roughness={0.2}
          metalness={0.6}
        />
      </mesh>
      <mesh scale={[0.5 * collectPulse, 0.5 * collectPulse, 0.5 * collectPulse]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} />
      </mesh>
      <pointLight color={color} intensity={1.5} distance={6} />
    </group>
  );
};

const DataParticles: React.FC<{ progress: number; color: string; from: [number, number, number]; to: [number, number, number] }> = ({
  progress,
  color,
  from,
  to,
}) => {
  const count = 40;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const t = (i / count + progress * 0.5) % 1;
      arr[i * 3] = from[0] + (to[0] - from[0]) * t + (Math.random() - 0.5) * 0.6;
      arr[i * 3 + 1] = from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI) * 1.2 + (Math.random() - 0.5) * 0.4;
      arr[i * 3 + 2] = from[2] + (to[2] - from[2]) * t + (Math.random() - 0.5) * 0.6;
    }
    return arr;
  }, [progress, from, to]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.06} transparent opacity={Math.min(progress * 3, 0.7)} />
    </points>
  );
};

const SynthesisPulse: React.FC<{ progress: number }> = ({ progress }) => {
  if (progress <= 0) return null;
  const scale = progress * 3;
  return (
    <mesh scale={[scale, scale, scale]}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial
        color={GOLD}
        transparent
        opacity={Math.max(0, 0.4 - progress * 0.4)}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

const PDFIcon: React.FC<{ progress: number }> = ({ progress }) => {
  if (progress <= 0) return null;
  return (
    <group position={[0, -2.5, 0]}>
      <mesh scale={[0.8 * progress, 1.0 * progress, 0.05]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.03]} scale={[0.6 * progress, 0.15 * progress, 0.01]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={GOLD} />
      </mesh>
      <mesh position={[0, -0.25, 0.03]} scale={[0.5 * progress, 0.08 * progress, 0.01]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#888" />
      </mesh>
      <mesh position={[0, -0.38, 0.03]} scale={[0.45 * progress, 0.06 * progress, 0.01]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#888" />
      </mesh>
    </group>
  );
};

const ProgressRing: React.FC<{ progress: number }> = ({ progress }) => {
  if (progress <= 0) return null;

  const ringGeo = useMemo(() => {
    const curve = new THREE.EllipseCurve(0, 0, 0.7, 0.7, 0, Math.PI * 2 * progress, false, 0);
    const pts = curve.getPoints(50);
    const shape = new THREE.Shape();
    const thickness = 0.03;
    pts.forEach((p, i) => {
      const nx = -p.y / Math.sqrt(p.x * p.x + p.y * p.y) * thickness;
      const ny = p.x / Math.sqrt(p.x * p.x + p.y * p.y) * thickness;
      if (i === 0) shape.moveTo(p.x + nx, p.y + ny);
      else shape.lineTo(p.x + nx, p.y + ny);
    });
    [...pts].reverse().forEach((p) => {
      const nx = -p.y / Math.sqrt(p.x * p.x + p.y * p.y) * thickness;
      const ny = p.x / Math.sqrt(p.x * p.x + p.y * p.y) * thickness;
      shape.lineTo(p.x - nx, p.y - ny);
    });
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, [progress]);

  return (
    <group position={[0, -2.5, 0.1]}>
      <mesh geometry={ringGeo}>
        <meshBasicMaterial color={GOLD} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame();

  const pulseP = frame / 270;
  const launchP = interpolate(frame, [30, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const collectP = interpolate(frame, [90, 150], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const returnP = interpolate(frame, [150, 210], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const synthP = interpolate(frame, [210, 240], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pdfP = interpolate(frame, [240, 270], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ringP = interpolate(frame, [245, 270], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const camAngle = interpolate(frame, [0, 270], [0, 0.3]);
  const camX = Math.sin(camAngle) * 8;
  const camZ = Math.cos(camAngle) * 8;

  return (
    <>
      <perspectiveCamera
        position={[camX, 4, camZ]}
        fov={35}
        near={0.1}
        far={100}
        // @ts-expect-error Remotion three compatibility
        makeDefault
      />
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} />

      <CentralNode pulseProgress={pulseP} />

      {AGENTS.map((agent) => (
        <React.Fragment key={agent.name}>
          <AgentOrb
            color={agent.color}
            startPos={[0, 0, 0]}
            targetPos={agent.targetPos}
            launchProgress={launchP}
            returnProgress={returnP}
            collectingProgress={collectP}
          />
          {collectP > 0 && collectP < 1 && (
            <DataParticles
              progress={collectP}
              color={agent.color}
              from={[agent.targetPos[0] * 1.5, agent.targetPos[1] + 1, agent.targetPos[2] * 1.5]}
              to={agent.targetPos}
            />
          )}
          {returnP > 0 && returnP < 1 && (
            <DataParticles
              progress={returnP}
              color={agent.color}
              from={agent.targetPos}
              to={[0, 0, 0]}
            />
          )}
        </React.Fragment>
      ))}

      <SynthesisPulse progress={synthP} />
      <PDFIcon progress={pdfP} />
      <ProgressRing progress={ringP} />
    </>
  );
};

export const AgentDispatchScene: React.FC = () => {
  const { width, height } = useVideoConfig();

  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{ position: [0, 4, 8], fov: 35 }}
      style={{ background: "transparent" }}
    >
      <Scene />
    </ThreeCanvas>
  );
};
