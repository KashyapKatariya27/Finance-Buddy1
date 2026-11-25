import React, { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

function AuroraCrystal() {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.getElapsedTime() * 0.25;
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.35;
    }
  });

  return (
    <Float speed={2.5} rotationIntensity={0.8} floatIntensity={1.2}>
      <mesh ref={meshRef} scale={1.8}>
        <octahedronGeometry args={[1, 0]} />
        <MeshDistortMaterial
          color="#06d6a0"
          emissive="#4361ee"
          emissiveIntensity={0.4}
          roughness={0.15}
          metalness={0.85}
          distort={0.25}
          speed={2}
          wireframe={false}
        />
      </mesh>
    </Float>
  );
}

function FloatingRing({ radius, color, rotationSpeed }: { radius: number; color: string; rotationSpeed: number }) {
  const ringRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.getElapsedTime() * rotationSpeed;
    }
  });

  return (
    <mesh ref={ringRef} rotation={[Math.PI / 3, 0, 0]}>
      <torusGeometry args={[radius, 0.03, 16, 64]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.2} metalness={0.9} />
    </mesh>
  );
}

export const HeroScene: React.FC = () => {
  return (
    <div className="w-full h-80 sm:h-96 relative flex items-center justify-center">
      {/* Background glow radial */}
      <div className="absolute inset-0 bg-radial-at-c from-aurora-electric/20 via-transparent to-transparent pointer-events-none blur-2xl" />

      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        className="w-full h-full"
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} color="#4cc9f0" />
        <directionalLight position={[-10, -10, -5]} intensity={1.2} color="#06d6a0" />
        <pointLight position={[0, 0, 2]} intensity={2} color="#f72585" />

        <Suspense fallback={null}>
          <AuroraCrystal />
          <FloatingRing radius={2.4} color="#4cc9f0" rotationSpeed={0.3} />
          <FloatingRing radius={2.8} color="#f72585" rotationSpeed={-0.2} />
        </Suspense>
      </Canvas>
    </div>
  );
};
