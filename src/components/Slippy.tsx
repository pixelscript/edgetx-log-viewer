import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useRef, useEffect } from 'react';
import SlippyMapGlobe from 'three-slippy-map-globe';
import { EARTH_RADIUS } from '../consts';

export default function Slippy() {
  const groupRef = useRef(null)
  const { camera } = useThree()
  const controlsRef = useRef(null)

  useEffect(() => {
    async function loadGlobe() {
      const globe = new SlippyMapGlobe(EARTH_RADIUS, {
        tileUrl: (x, y, l) => `https://tile.openstreetmap.org/${l}/${x}/${y}.png`
      })
      groupRef.current.add(globe)

      camera.near = 1e-3
      camera.far = EARTH_RADIUS * 100
      camera.updateProjectionMatrix()
      camera.position.z = EARTH_RADIUS * 6

      controlsRef.current.minDistance = EARTH_RADIUS * (1 + 5 / 2 ** globe.maxLevel)
      controlsRef.current.maxDistance = camera.far - EARTH_RADIUS

      globe.updatePov(camera)
      controlsRef.current.addEventListener('change', () => {
        globe.updatePov(camera)
        const distToSurface = camera.position.distanceTo(globe.position) - EARTH_RADIUS
        controlsRef.current.rotateSpeed = distToSurface / EARTH_RADIUS * 0.4
        controlsRef.current.zoomSpeed = Math.sqrt(distToSurface / EARTH_RADIUS) * 0.6
      })
    }

    loadGlobe()
  }, [camera])

  return (
    <group ref={groupRef}>
      <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.1} />
    </group>
  )
}