"use client";

import { useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Float } from "@react-three/drei";
import * as THREE from "three";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";
import { audioManager } from "@/lib/analyzer/audioManager";

function SonicFriend() {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<any>(null);
  
  // Audio data buffer
  const dataArray = useMemo(() => new Uint8Array(64), []);
  
  // Smooth values for animation
  const targetScale = useRef(1);
  const targetDistort = useRef(0.4);
  const targetColor = useRef(new THREE.Color("#10b981")); // Emerald default

  useFrame((state) => {
    if (!meshRef.current || !materialRef.current) return;

    // Get audio data
    let bass = 0;
    let mid = 0;
    
    if (audioManager.analyserSpectrum) {
      audioManager.analyserSpectrum.getByteFrequencyData(dataArray);
      // Bass (0-3), Mid (8-12)
      bass = (dataArray[1] + dataArray[2] + dataArray[3]) / (255 * 3);
      mid = (dataArray[8] + dataArray[9] + dataArray[10] + dataArray[11]) / (255 * 4);
    }

    // Calculate targets based on audio
    // Scale pumps with bass
    const desiredScale = 1 + bass * 0.6;
    targetScale.current = THREE.MathUtils.lerp(targetScale.current, desiredScale, 0.1);
    
    // Distortion increases with mids
    const desiredDistort = 0.4 + mid * 1.0;
    targetDistort.current = THREE.MathUtils.lerp(targetDistort.current, desiredDistort, 0.05);

    // Color shift based on intensity
    const baseColor = new THREE.Color("#10b981"); // Emerald
    const activeColor = new THREE.Color("#06b6d4"); // Cyan/Accent
    const peakColor = new THREE.Color("#8b5cf6"); // Violet
    
    if (bass > 0.5) {
       targetColor.current.lerp(peakColor, 0.05);
    } else if (bass > 0.1) {
       targetColor.current.lerp(activeColor, 0.02);
    } else {
       targetColor.current.lerp(baseColor, 0.02);
    }

    // Apply transforms
    meshRef.current.scale.setScalar(targetScale.current);
    materialRef.current.distort = targetDistort.current;
    materialRef.current.color = targetColor.current;
    
    // Movement - "Navigates the site"
    // Wandering path
    const time = state.clock.getElapsedTime();
    // Lissajous-like curve for organic wandering
    const x = Math.sin(time * 0.15) * 4 + Math.cos(time * 0.4) * 1;
    const y = Math.cos(time * 0.2) * 2 + Math.sin(time * 0.3) * 0.5;
    
    // Smoothly interpolate position
    meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, x, 0.02);
    meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, y, 0.02);
  });

  return (
    <Float
      speed={2} 
      rotationIntensity={0.5} 
      floatIntensity={1} 
      floatingRange={[-0.5, 0.5]}
    >
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.5, 128, 128]} />
        <MeshDistortMaterial
          ref={materialRef}
          color="#10b981"
          envMapIntensity={0.5}
          clearcoat={0.8}
          clearcoatRoughness={0.2}
          metalness={0.2}
          roughness={0.4}
          speed={3} // Animation speed of the distortion
          distort={0.4} // Strength of the distortion
          radius={1}
        />
      </mesh>
    </Float>
  );
}

function Particles() {
  const count = 50;
  const mesh = useRef<THREE.InstancedMesh>(null);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const t = Math.random() * 100;
      const factor = 20 + Math.random() * 100;
      const speed = 0.01 + Math.random() / 200;
      const xFactor = -10 + Math.random() * 20;
      const yFactor = -10 + Math.random() * 20;
      const zFactor = -10 + Math.random() * 20;
      temp.push({ t, factor, speed, xFactor, yFactor, zFactor, mx: 0, my: 0 });
    }
    return temp;
  }, []);

  useFrame((state) => {
    if (!mesh.current) return;
    
    particles.forEach((particle, i) => {
      let { t, factor, speed, xFactor, yFactor, zFactor } = particle;
      t = particle.t += speed / 2;
      const a = Math.cos(t) + Math.sin(t * 1) / 10;
      const b = Math.sin(t) + Math.cos(t * 2) / 10;
      const s = Math.cos(t);
      
      dummy.position.set(
        (particle.mx / 10) * a + xFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 1) * factor) / 10,
        (particle.my / 10) * b + yFactor + Math.sin((t / 10) * factor) + (Math.cos(t * 2) * factor) / 10,
        (particle.my / 10) * b + zFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 3) * factor) / 10
      );
      dummy.scale.setScalar(s * 0.1 + 0.05);
      dummy.rotation.set(s * 5, s * 5, s * 5);
      dummy.updateMatrix();
      
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[0.2, 0]} />
      <meshPhongMaterial color="#06b6d4" transparent opacity={0.4} />
    </instancedMesh>
  );
}

export default function AnalyzerBackground3D() {
  const audioRef = useTekkinPlayer((s) => s.audioRef);
  const isPlaying = useTekkinPlayer((s) => s.isPlaying);

  useEffect(() => {
    if (audioRef?.current) {
      audioManager.attach(audioRef.current);
      if (isPlaying) audioManager.resume();
    }
  }, [audioRef, isPlaying]);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none" style={{ pointerEvents: 'none' }}>
      <Canvas camera={{ position: [0, 0, 10], fov: 45 }} style={{ pointerEvents: 'none' }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#ffffff" />
        <pointLight position={[-10, -10, -5]} intensity={0.8} color="#06b6d4" />
        
        <SonicFriend />
        <Particles />
        
        <fog attach="fog" args={["black", 5, 25]} />
      </Canvas>
      {/* Gradient overlay to fade out edges */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black opacity-50" style={{ pointerEvents: 'none' }} />
    </div>
  );
}
