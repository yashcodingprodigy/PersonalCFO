'use client';

// The living "money brain" — a glowing core with each of the user's dreams in
// orbit around it. Planet colour = dream status; hover a planet to see it.
// three.js is loaded lazily (never blocks first paint), pauses when off-screen,
// follows the pointer + page scroll, and renders a single still frame when the
// user prefers reduced motion. If WebGL is unavailable we fall back to the CSS orb.

import { useEffect, useRef, useState } from 'react';

export interface ScenePlanet { id: string; name: string; status: string; progress: number }

const STATUS_COLOR: Record<string, number> = {
  achieved: 0xf2c14e, on_track: 0x2fbc9b, stretch: 0xf59e0b, needs_tradeoff: 0xf87171,
};

const VERT = `
  uniform float uTime; uniform float uPulse;
  varying vec3 vNormal; varying vec3 vView; varying float vWave;
  void main() {
    vec3 p = position;
    float w = sin(p.x * 4.1 + uTime * 1.3) * cos(p.y * 3.7 + uTime * 1.1) * sin(p.z * 3.3 + uTime * 0.9);
    vWave = w;
    p += normal * (w * 0.035 + uPulse * 0.10);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = `
  uniform float uTime;
  varying vec3 vNormal; varying vec3 vView; varying float vWave;
  void main() {
    float f = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.2);
    vec3 deep = vec3(0.04, 0.20, 0.18);
    vec3 mint = vec3(0.50, 0.88, 0.78);
    vec3 teal = vec3(0.27, 0.79, 0.88);
    vec3 c = mix(deep, mix(mint, teal, 0.5 + 0.5 * sin(uTime * 0.6 + vWave * 4.0)), 0.35 + vWave * 0.6);
    c += f * vec3(0.55, 1.0, 0.9) * 1.2;
    gl_FragColor = vec4(c, 1.0);
  }`;

function glowTexture(THREE: typeof import('three')) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}

export function BrainScene({ planets, pulseKey = 0, className = '' }: { planets: ScenePlanet[]; pulseKey?: number; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const pulseRef = useRef(0);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<{ name: string; x: number; y: number; status: string } | null>(null);
  const sig = planets.map((p) => `${p.id}:${p.status}:${Math.round(p.progress * 20)}`).join('|');

  useEffect(() => { pulseRef.current = 1; }, [pulseKey]);

  useEffect(() => {
    const el = host.current; if (!el) return;
    let disposed = false; let raf = 0; let cleanup = () => {};
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    import('three').then((THREE) => {
      if (disposed) return;
      let renderer: import('three').WebGLRenderer;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
      catch { setFailed(true); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      el.appendChild(renderer.domElement);
      renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 0.4, 7.2);
      const world = new THREE.Group(); scene.add(world);

      // Core
      const coreMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: false, uniforms: { uTime: { value: 0 }, uPulse: { value: 0 } } });
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 6), coreMat);
      world.add(core);
      const glowTex = glowTexture(THREE);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x2fbc9b, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.set(4.6, 4.6, 1); world.add(halo);
      const shell = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.45, 1)), new THREE.LineBasicMaterial({ color: 0x7fe0c8, transparent: true, opacity: 0.12 }));
      world.add(shell);

      // Stardust
      const N = 700; const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const r = 3.2 + Math.random() * 5; const th = Math.random() * Math.PI * 2; const ph = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.cos(ph) * 0.6; pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      }
      const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.035, color: 0x9ff0dc, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      scene.add(dust);

      // Dreams in orbit
      const list = planets.length ? planets.slice(0, 7) : [{ id: 'empty', name: '', status: 'on_track', progress: 0 }];
      const orbiters: { pivot: import('three').Group; mesh: import('three').Mesh; speed: number; p: ScenePlanet }[] = [];
      list.forEach((p, i) => {
        const radius = 1.8 + i * 0.36;
        const tilt = new THREE.Group();
        tilt.rotation.order = 'YXZ'; // tilt the ring flat first, then spin it around the vertical axis
        tilt.rotation.x = Math.PI / 2 - 0.22 - (i % 3) * 0.16; tilt.rotation.y = i * 0.95; tilt.rotation.z = (i % 2 ? 1 : -1) * 0.12; world.add(tilt);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.006, 6, 160), new THREE.MeshBasicMaterial({ color: 0x7fe0c8, transparent: true, opacity: 0.16 }));
        tilt.add(ring);
        // Progress arc: brighter section of the orbit = how funded the dream is
        if (p.progress > 0.02) {
          const arc = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.014, 6, 120, Math.PI * 2 * Math.min(1, p.progress)), new THREE.MeshBasicMaterial({ color: STATUS_COLOR[p.status] ?? 0x2fbc9b, transparent: true, opacity: 0.75 }));
          tilt.add(arc);
        }
        if (p.id === 'empty') return;
        const pivot = new THREE.Group(); tilt.add(pivot);
        const color = STATUS_COLOR[p.status] ?? 0x2fbc9b;
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.13 + Math.min(0.08, p.progress * 0.08), 24, 24), new THREE.MeshBasicMaterial({ color }));
        mesh.position.set(radius, 0, 0); mesh.userData = p; pivot.add(mesh);
        const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
        g.scale.set(0.9, 0.9, 1); mesh.add(g);
        pivot.rotation.z = (i / list.length) * Math.PI * 2;
        orbiters.push({ pivot, mesh, speed: 0.18 / (1 + i * 0.35), p });
      });

      // Sizing
      const resize = () => {
        const w = el.clientWidth || 1, h = el.clientHeight || 1;
        renderer.setSize(w, h, false); camera.aspect = w / h;
        camera.position.z = Math.max(7.2, 7.2 * (1.25 / Math.max(0.5, w / h)));
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize); ro.observe(el);

      // Pointer parallax + hover picking
      const mouse = new THREE.Vector2(9, 9); let tx = 0, ty = 0;
      const ray = new THREE.Raycaster();
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1; mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
        tx = mouse.x * 0.35; ty = mouse.y * 0.2;
      };
      const onLeave = () => { mouse.set(9, 9); tx = 0; ty = 0; setHover(null); };
      el.addEventListener('pointermove', onMove); el.addEventListener('pointerleave', onLeave);

      let visible = true;
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !reduced) loop(); }, { threshold: 0 });
      io.observe(el);

      const clock = new THREE.Clock(); let lastHover = '';
      const frame = () => {
        const t = clock.getElapsedTime();
        coreMat.uniforms.uTime.value = t;
        pulseRef.current *= 0.94; coreMat.uniforms.uPulse.value = pulseRef.current;
        const scroll = Math.min(1, window.scrollY / 700);
        world.rotation.y += (tx + t * 0.06 - world.rotation.y) * 0.04;
        world.rotation.x += (-ty + scroll * 0.5 - world.rotation.x) * 0.05;
        world.position.y = scroll * 0.8;
        shell.rotation.y = -t * 0.08; dust.rotation.y = t * 0.012;
        halo.material.opacity = 0.45 + Math.sin(t * 1.4) * 0.08 + pulseRef.current * 0.4;
        for (const o of orbiters) o.pivot.rotation.z += reduced ? 0 : o.speed * 0.016;
        renderer.render(scene, camera);

        if (mouse.x < 5) {
          ray.setFromCamera(mouse, camera);
          const hit = ray.intersectObjects(orbiters.map((o) => o.mesh), false)[0];
          const key = hit ? (hit.object.userData as ScenePlanet).id : '';
          if (hit) {
            const v = new THREE.Vector3(); hit.object.getWorldPosition(v); v.project(camera);
            const r = el.getBoundingClientRect();
            const p = hit.object.userData as ScenePlanet;
            setHover({ name: p.name, status: p.status, x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height });
            el.style.cursor = 'pointer';
          } else if (lastHover) { setHover(null); el.style.cursor = ''; }
          lastHover = key;
        }
      };
      const loop = () => { cancelAnimationFrame(raf); if (disposed || !visible || document.hidden) return; frame(); raf = requestAnimationFrame(loop); };
      const onVis = () => { if (!document.hidden && !reduced) loop(); };
      document.addEventListener('visibilitychange', onVis);
      if (reduced) frame(); else loop();

      cleanup = () => {
        cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerleave', onLeave);
        scene.traverse((o: any) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x: any) => x.dispose?.()); });
        glowTex.dispose(); renderer.dispose(); renderer.domElement.remove();
      };
    }).catch(() => setFailed(true));

    return () => { disposed = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  if (failed) {
    return (
      <div className={`relative grid place-items-center ${className}`} aria-hidden>
        <span className="relative w-48 h-48 rounded-full pw-orb" />
      </div>
    );
  }
  return (
    <div ref={host} className={`relative ${className}`} aria-hidden={!planets.length}>
      {hover && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[140%] rounded-full bg-white/95 text-pine-950 text-xs font-bold px-3 py-1.5 shadow-lift whitespace-nowrap pw-pop-in"
          style={{ left: hover.x, top: hover.y }}>
          <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: `#${(STATUS_COLOR[hover.status] ?? 0x2fbc9b).toString(16).padStart(6, '0')}` }} />
          {hover.name}
        </div>
      )}
    </div>
  );
}
