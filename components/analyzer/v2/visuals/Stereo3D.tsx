"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Text } from "@react-three/drei";
import * as THREE from "three";

function StereoLegend() {
  return (
    <group>
      {/* Grid on XY plane (rotated from XZ) */}
      <gridHelper args={[5, 4, 0x444444, 0x222222]} rotation={[Math.PI / 2, 0, 0]} />
      
      {/* Labels */}
      <Text position={[2.8, 0, 0]} fontSize={0.15} color="#888888">Side (+)</Text>
      <Text position={[-2.8, 0, 0]} fontSize={0.15} color="#888888">Side (-)</Text>
      <Text position={[0, 2.8, 0]} fontSize={0.15} color="#888888">Mid (+)</Text>
      <Text position={[0, -2.8, 0]} fontSize={0.15} color="#888888">Mid (-)</Text>
    </group>
  );
}

function ParticleCloud({ points }: { points: { x: number; y: number }[] }) {
  const mesh = useRef<THREE.Points>(null);

  // Convertiamo i punti 2D in 3D.
  // Mappiamo X (Side) -> X
  // Mappiamo Y (Mid) -> Y
  // Z lo usiamo per dare profondità basata sull'ampiezza o random per effetto "volume"
  const positions = useMemo(() => {
    const count = points.length;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const { x, y } = points[i];
      // Normalizziamo un po' lo spread
      arr[i * 3] = x * 2.5;     // X
      arr[i * 3 + 1] = y * 2.5; // Y
      // Z leggermente random per dare volume alla nuvola
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.5; 
    }
    return arr;
  }, [points]);

  useFrame((state) => {
    if (mesh.current) {
      // Rotazione lenta automatica per effetto 3D
      mesh.current.rotation.y += 0.002;
    }
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        color="#34d399" // Emerald-400
        transparent
        opacity={0.6}
        sizeAttenuation={true}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function StereoVisualizer3D({
  points,
}: {
  points: { x: number; y: number }[];
}) {
  if (!points || points.length === 0) return null;

  return (
    <div className="h-[250px] w-full overflow-hidden rounded-xl bg-black/40 border border-white/5 relative">
      <div className="absolute top-3 left-3 z-10 text-[10px] uppercase tracking-widest text-white/40 pointer-events-none">
        3D Vector Scope
      </div>
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 4]} />
        <color attach="background" args={["#000000"]} />
        {/* Luci ambientali per dare un po' di tono se usassimo mesh solide */}
        <ambientLight intensity={0.5} />
        
        <StereoLegend />
        <ParticleCloud points={points} />
        
        {/* Controlli utente limitati per non rompere la vista */}
        <OrbitControls 
          enableZoom={false} 
          enablePan={false} 
          autoRotate={false}
          maxPolarAngle={Math.PI / 1.5}
          minPolarAngle={Math.PI / 3}
        />
      </Canvas>
    </div>
  );
}
