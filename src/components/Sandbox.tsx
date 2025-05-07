import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { OrbitControls} from '@react-three/drei';

function CubeOnSphere() {

  const cubeRef = useRef(null)
  const pivotRef = useRef(null)

  useFrame(() => {
    const sphereCenter = new THREE.Vector3(0, 0, 0)
    const cubeWorldPos = new THREE.Vector3(3, 1, 3)

    const normal = new THREE.Vector3().subVectors(cubeWorldPos, sphereCenter).normalize()
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)
    if(!pivotRef.current) return;
    pivotRef.current.position.copy(cubeWorldPos)
    pivotRef.current.quaternion.copy(quaternion)
  })

  return (
    <>
      <mesh>
        <sphereGeometry args={[2, 32, 32]} />
        <meshStandardMaterial color="gray" wireframe />
      </mesh>
      <group ref={pivotRef}>
        <mesh ref={cubeRef}>
          <boxGeometry args={[0.5, 0.1, 0.5]} />
          <meshStandardMaterial color="red" />
        </mesh>
      </group>
    </>
  )
}

export default function Scene() {
  return (
    <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
      <ambientLight />
      <pointLight position={[10, 10, 10]} />
      <CubeOnSphere />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={1}
        zoomSpeed={0.4}
        rotateSpeed={0.3}
      />
    </Canvas>
  )
}