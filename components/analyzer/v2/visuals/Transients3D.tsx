"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sphere, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

type Props = {
  strength: number; // 0..1 (impatto)
  density: number;  // 0..1 (densità eventi)
  crest: number;    // dB (dinamica)
};

function TransientObject({ strength, density, crest }: Props) {
  const mesh = useRef<THREE.Mesh>(null);
  
  // Mappiamo i valori su parametri visivi
  // Crest factor alto -> più distorsione (spiky)
  // Strength alta -> più velocità di movimento
  // Density alta -> colore più caldo/intenso
  
  const distort = useMemo(() => {
    // Crest tipico: 10-20dB. 
    // <10 = flat (0.2), >18 = spiky (0.8)
    const norm = Math.max(0, Math.min(1, (crest - 8) / 12));
    return 0.3 + norm * 0.6; 
  }, [crest]);

  const speed = useMemo(() => {
    return 1 + strength * 3;
  }, [strength]);

  const color = useMemo(() => {
    // Density bassa (0) -> Blu/Freddo
    // Density alta (1) -> Rosso/Caldo
    const c1 = new THREE.Color("#3b82f6"); // Blue
    const c2 = new THREE.Color("#ef4444"); // Red
    return c1.lerp(c2, density);
  }, [density]);

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.x = state.clock.elapsedTime * 0.2;
      mesh.current.rotation.y = state.clock.elapsedTime * 0.3;
    }
  });

  return (
    <Sphere args={[1, 64, 64]} ref={mesh} scale={1.8}>
      <MeshDistortMaterial
        color={color}
        envMapIntensity={0.4}
        clearcoat={1}
        clearcoatRoughness={0.1}
        metalness={0.1}
        distort={distort}
        speed={speed}
        radius={1}
      />
    </Sphere>
  );
}

export default function Transients3D(props: Props) {
  return (
    <div className="w-full h-full min-h-[200px] relative rounded-xl overflow-hidden bg-black/20">
      <Canvas camera={{ position: [0, 0, 4], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        <TransientObject {...props} />
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={1} />
      </Canvas>
      
      <div className="absolute bottom-3 left-3 text-[10px] text-white/50 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white/20" />
          <span>Shape = Crest Factor</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white/20" />
          <span>Speed = Strength</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white/20" />
          <span>Color = Density</span>
        </div>
      </div>
    </div>
  );
}
