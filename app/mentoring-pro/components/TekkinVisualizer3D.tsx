"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = {
  /** funzione che riempie un Float32Array/Uint8Array con i dati dell’Analyser e ritorna un livello [0..1] */
  getLevel: () => number;
  /** cambia la forma: "logo", "cube", "torus" */
  shape?: "logo" | "cube" | "torus";
  /** dimensione in px (width full, height passato) */
  height?: number;
};

export default function TekkinVisualizer3D({ getLevel, shape = "logo", height = 280 }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const heightPx = height;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, heightPx);
    renderer.setClearColor(0x000000, 0); // trasparente sopra lo sfondo del player
    mountRef.current.appendChild(renderer.domElement);

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / heightPx, 0.1, 100);
    camera.position.set(0, 0, 4);

    // Luci
    scene.add(new THREE.AmbientLight(0x3ffff0, 0.6));
    const dir = new THREE.DirectionalLight(0x43ffd2, 1.2);
    dir.position.set(2, 3, 2);
    scene.add(dir);

    // Materiale con “neon edge”
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0aa39a"),
      roughness: 0.35,
      metalness: 0.6,
      emissive: new THREE.Color("#1bffdf"),
      emissiveIntensity: 0.15,
    });

    // Geometria “logo” stile pixel (un icosaedro leggermente distorto)
    let mesh: THREE.Mesh;
    if (shape === "torus") {
      mesh = new THREE.Mesh(new THREE.TorusKnotGeometry(0.7, 0.22, 180, 24), mat);
    } else if (shape === "cube") {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1, 8, 8, 8), mat);
    } else {
      const geo = new THREE.IcosahedronGeometry(0.95, 2);
      // “pixelizzazione” delle normali per look low-poly
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        v.normalize().multiplyScalar(0.95 + (Math.sin(i * 12.9898) * 43758.5453 % 0.04) - 0.02);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      pos.needsUpdate = true;
      mesh = new THREE.Mesh(geo, mat);
    }
    scene.add(mesh);

    // Outline neon
    const outline = new THREE.Mesh(
      (mesh.geometry as THREE.BufferGeometry).clone(),
      new THREE.MeshBasicMaterial({ color: 0x43ffd2, wireframe: true, transparent: true, opacity: 0.22 })
    );
    outline.scale.setScalar(1.03);
    scene.add(outline);

    // Plane per “pixel effect” post semplice (render in bassa risoluzione su RenderTarget)
    const rt = new THREE.WebGLRenderTarget(Math.floor(width / 3), Math.floor(heightPx / 3));
    const quadScene = new THREE.Scene();
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: rt.texture },
        time: { value: 0 },
        glitchAmt: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv; void main(){
          vUv = uv; gl_Position = vec4(position,1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv; uniform sampler2D tDiffuse; uniform float time; uniform float glitchAmt;
        // pixel size
        vec2 pixel(vec2 uv, float px){ return floor(uv*px)/px; }
        void main(){
          // lieve shift RGB tipo aberrazione + scanline flicker controllata da glitchAmt
          float px = mix(200.0, 70.0, glitchAmt); // più beat -> meno pixels -> più definito e pulsante
          vec2 uvp = pixel(vUv, px);
          float scan = 0.04 * sin(uvp.y*120.0 + time*10.0);
          vec2 shift = vec2(0.002*glitchAmt, 0.0);
          vec3 col;
          col.r = texture2D(tDiffuse, uvp + shift).r;
          col.g = texture2D(tDiffuse, uvp).g + scan;
          col.b = texture2D(tDiffuse, uvp - shift).b;
          // vignetta molto leggera
          float v = smoothstep(1.2, 0.2, length(uvp-0.5));
          gl_FragColor = vec4(col*v, 1.0);
        }
      `,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat);
    quadScene.add(quad);

    // Resize
    const onResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = heightPx;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rt.setSize(Math.floor(w / 3), Math.floor(h / 3));
    };
    window.addEventListener("resize", onResize);

    // Animazione
    let raf = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      const t = clock.getElapsedTime();
      const lvl = getLevel(); // 0..1
      // mapping a rotazione e scala
      mesh.rotation.x += 0.004 + lvl * 0.02;
      mesh.rotation.y += 0.006 + lvl * 0.03;
      const s = 1 + lvl * 0.25;
      mesh.scale.setScalar(s);
      outline.scale.setScalar(1.03 * s);

      // “glitch”/pixel density in funzione del livello
      quadMat.uniforms.time.value = t;
      quadMat.uniforms.glitchAmt.value = THREE.MathUtils.clamp(lvl * 1.6, 0, 1);

      // render low-res -> upscalato con shader “pixel”
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(quadScene, quadCam);

      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      rt.dispose();
      renderer.dispose();
      mesh.geometry.dispose();
      outline.geometry.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, [getLevel, height, shape]);

  return <div ref={mountRef} className="w-full" style={{ height }} />;
}
