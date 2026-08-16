/* ha-3d-card — Casa 3D animata per Home Assistant (custom card)
   Uso: {"type": "custom:ha-3d-card"} */
(() => {
  const CDNS = [
    "https://unpkg.com/three@0.160.0/build/three.module.js",
    "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
  ];
  let THREE = null;
  async function loadThree() {
    if (THREE) return THREE;
    for (const url of CDNS) {
      try {
        const mod = await import(url);
        THREE = mod;
        return THREE;
      } catch (e) { console.warn("ha-3d-card: CDN fallito", url, e); }
    }
    return null;
  }

  const NUM = (v, d) => { const n = parseFloat(v); return isFinite(n) ? n : d; };
  const ST = (h, id, d = "unknown") => (h && h.states && h.states[id]) ? h.states[id].state : d;

  class Ha3dCard extends HTMLElement {
    constructor() {
      super();
      this._hass = null;
      this._cfg = {};
      this._refs = {};   // refs agli oggetti 3D per entità
      this._raf = 0;
      this._cleanupFns = [];
      this._ro = null;
      this._t = 0;
      this._drag = { active: false, px: 0, py: 0, ry: 0, rx: 0.42 };
    }

    setConfig(config) {
      this._cfg = config || {};
      if (this._hass) this._build();
    }

    set hass(hass) {
      this._hass = hass;
      this._updateStates();
    }

    connectedCallback() {
      this._build();
      if (this._hass) this._updateStates();
    }

    disconnectedCallback() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
      (this._cleanupFns || []).forEach(f => { try { f(); } catch (e) {} });
      this._cleanupFns = [];
      if (this._ro) this._ro.disconnect();
      if (this._renderer) this._renderer.dispose();
      this.innerHTML = "";
    }

    /* ---------- BUILD ---------- */
    async _build() {
      if (!this._hass) return; // aspetta hass (evita double-build)
      if (this._built) return;
      this._built = true;
      const three = await loadThree();
      if (!three) { this.innerHTML = `<ha-card style="padding:16px">Impossibile caricare Three.js (CDN non raggiungibile).</ha-card>`; return; }
      this._initScene(three);
      this._buildWorld(three);
      this._buildHud();
      this._startLoop(three);
      if (this._hass) this._updateStates();
    }

    _initScene(three) {
      this.innerHTML = "";
      const wrap = document.createElement("div");
      wrap.style.cssText = "position:relative;width:100%;height:620px;border-radius:16px;overflow:hidden;background:radial-gradient(ellipse at 50% 0%,#0d1b2e 0%,#0a0f1e 55%,#05070f 100%);";
      const canvas = document.createElement("div");
      canvas.style.cssText = "position:absolute;inset:0;";
      wrap.appendChild(canvas);
      const hud = document.createElement("div");
      hud.style.cssText = "position:absolute;inset:0;pointer-events:none;";
      wrap.appendChild(hud);
      this.appendChild(wrap);
      this._hud = hud;

      const scene = new three.Scene();
      scene.fog = new three.Fog(0x0a0f1e, 30, 70);
      const camera = new three.PerspectiveCamera(45, 1, 0.1, 200);
      camera.position.set(20, 14, 20);
      camera.lookAt(0, 2, 0);
      const renderer = new three.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = three.PCFSoftShadowMap;
      renderer.toneMapping = three.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      canvas.appendChild(renderer.domElement);

      // luci
      const hemi = new three.HemisphereLight(0xbfd4ff, 0x0a0f1e, 0.55);
      scene.add(hemi);
      const sun = new three.DirectionalLight(0xfff2d9, 1.6);
      sun.position.set(14, 22, 8);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
      sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
      scene.add(sun);
      const fill = new three.DirectionalLight(0x4d7cff, 0.5);
      fill.position.set(-12, 8, -10);
      scene.add(fill);
      const glow = new three.PointLight(0x00d9ff, 0.8, 40);
      glow.position.set(0, 6, 0);
      scene.add(glow);
      this._glowLight = glow;

      this._three = three;
      this._scene = scene;
      this._camera = camera;
      this._renderer = renderer;
      this._canvas = canvas;

      const onResize = () => {
        const w = wrap.clientWidth, h = wrap.clientHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      onResize();
      this._ro = new ResizeObserver(onResize);
      this._ro.observe(wrap);

      // drag / rotazione
      const onDown = (e) => { this._drag.active = true; this._drag.px = e.clientX; this._drag.py = e.clientY; wrap.style.cursor = "grabbing"; };
      const onMove = (e) => {
        if (!this._drag.active) return;
        this._drag.ry += (e.clientX - this._drag.px) * 0.006;
        this._drag.rx = Math.max(0.15, Math.min(1.1, this._drag.rx + (e.clientY - this._drag.py) * 0.004));
        this._drag.px = e.clientX; this._drag.py = e.clientY;
      };
      const onUp = () => { this._drag.active = false; wrap.style.cursor = "grab"; };
      wrap.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      this._cleanupFns.push(() => {
        wrap.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      });
      wrap.style.cursor = "grab";
    }

    /* ---------- WORLD ---------- */
    _buildWorld(T) {
      const s = this._scene;
      const R = (w, h, d, color, opts = {}) => {
        const m = new T.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.8, metalness: opts.metalness ?? 0.1, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 1, transparent: opts.transparent ?? false, opacity: opts.opacity ?? 1 });
        const g = new T.BoxGeometry(w, h, d);
        const mesh = new T.Mesh(g, m);
        if (opts.cast !== false) mesh.castShadow = true;
        if (opts.receive !== false) mesh.receiveShadow = true;
        return mesh;
      };
      const G = (mat) => { const g = new T.CylinderGeometry(0.02, 0.02, 1, 8); return new T.Mesh(g, mat); };
      const matG = (c) => new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.4, transparent: true, opacity: 0.9 });

      // ---- base piattaforma vetro
      const platform = new T.Mesh(new T.CylinderGeometry(11.5, 12, 0.35, 64), new T.MeshStandardMaterial({ color: 0x122238, roughness: 0.25, metalness: 0.7, transparent: true, opacity: 0.92 }));
      platform.position.y = -0.3;
      platform.receiveShadow = true;
      s.add(platform);
      const ring = new T.Mesh(new T.TorusGeometry(11.6, 0.06, 8, 90), matG(0x00d9ff));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.02;
      s.add(ring);
      const ring2 = new T.Mesh(new T.TorusGeometry(8.6, 0.04, 8, 80), matG(0x9d6bff));
      ring2.rotation.x = Math.PI / 2;
      ring2.position.y = 0.03;
      s.add(ring2);
      this._refs.ring1 = ring; this._refs.ring2 = ring2;

      // griglia luminosa
      const grid = new T.GridHelper(24, 24, 0x00d9ff, 0x1b3a5c);
      grid.position.y = 0.06;
      grid.material.transparent = true; grid.material.opacity = 0.35;
      s.add(grid);

      // ---- CASA (moderna: 2 piani, tetto piano)
      const house = new T.Group();
      // corpo principale
      const body = R(7, 3.4, 5.6, 0xdfe7f2, { roughness: 0.35, metalness: 0.15 });
      body.position.y = 1.7;
      house.add(body);
      // fascia vetro piano 1
      const band = R(7.02, 0.9, 5.62, 0x0e2a47, { roughness: 0.2, metalness: 0.6, transparent: true, opacity: 0.85 });
      band.position.y = 2.05;
      house.add(band);
      // piano 2
      const body2 = R(7, 3.2, 5.6, 0xc9d6e8, { roughness: 0.35, metalness: 0.15 });
      body2.position.y = 4.55;
      house.add(body2);
      const band2 = R(7.02, 0.9, 5.62, 0x0e2a47, { roughness: 0.2, metalness: 0.6, transparent: true, opacity: 0.85 });
      band2.position.y = 4.9;
      house.add(band2);
      // tetto
      const roof = R(7.4, 0.5, 6.0, 0xffffff, { roughness: 0.2, metalness: 0.1 });
      roof.position.y = 6.3;
      house.add(roof);
      // falde
      const overhang = R(7.6, 0.18, 6.2, 0x9fb3cc, { roughness: 0.5 });
      overhang.position.y = 6.05;
      house.add(overhang);
      // finestre piano 2 (luci: glow giallo se accese)
      const winMat = new T.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffb020, emissiveIntensity: 0.15, transparent: true, opacity: 0.95 });
      const wins = [];
      for (let i = -1; i <= 1; i += 0.8) {
        const w = new T.Mesh(new T.PlaneGeometry(0.85, 1.1), winMat);
        w.position.set(i, 4.8, 2.82);
        w.rotation.y = Math.PI;
        house.add(w); wins.push(w);
        const w2 = w.clone(); w2.position.z = -2.82; w2.rotation.y = 0;
        house.add(w2); wins.push(w2);
      }
      // finestra TV soggiorno (piano 1, lato +x)
      const tvWin = new T.Mesh(new T.PlaneGeometry(1.6, 0.9), new T.MeshStandardMaterial({ color: 0x10233c, emissive: 0x1a5cff, emissiveIntensity: 0.1, transparent: true, opacity: 0.9 }));
      tvWin.position.set(3.52, 2.15, 0.6);
      tvWin.rotation.y = Math.PI / 2;
      house.add(tvWin);
      // porta ingresso (lato -z)
      const door = R(1.3, 2.2, 0.15, 0x1c2b3a, { roughness: 0.6, metalness: 0.2 });
      door.position.set(0, 1.1, 2.82);
      house.add(door);
      const doorFrame = R(1.7, 2.6, 0.12, 0x8fa6c0, { roughness: 0.4 });
      doorFrame.position.set(0, 1.3, 2.8);
      house.add(doorFrame);
      // antenna
      const ant = R(0.08, 0.9, 0.08, 0x9fb3cc, { metalness: 0.8, roughness: 0.3 });
      ant.position.set(-2.6, 6.7, 1.8);
      house.add(ant);
      const antTop = new T.Mesh(new T.SphereGeometry(0.12, 10, 10), matG(0xff3355));
      antTop.position.set(-2.6, 7.2, 1.8);
      house.add(antTop);
      this._refs.antenna = antTop;
      house.position.set(-1.2, 0, 0.6);
      s.add(house);
      this._house = house;
      this._refs.windows = wins;
      this._refs.tvWin = tvWin;
      this._refs.door = door;

      // ---- GARAGE + TESLA (sinistra)
      const garage = new T.Group();
      const gBody = R(4.6, 2.6, 5.2, 0xc9d6e8, { roughness: 0.4 });
      gBody.position.y = 1.3;
      garage.add(gBody);
      const gRoof = R(5.0, 0.35, 5.6, 0xffffff, { roughness: 0.25 });
      gRoof.position.y = 2.7;
      garage.add(gRoof);
      const gOpen = R(4.6, 0.02, 4.4, 0x0a1420, { roughness: 0.1, metalness: 0.4 });
      gOpen.position.set(0, 2.02, 0);
      garage.add(gOpen);
      const gFrame = R(4.7, 0.14, 4.5, 0x8fa6c0, { roughness: 0.4 });
      gFrame.position.set(0, 2.1, 0);
      garage.add(gFrame);
      // porta garage apribile (slide up quando ricarica)
      const gDoor = R(4.6, 1.6, 0.12, 0xdfe7f2, { roughness: 0.5, transparent: true, opacity: 0.95 });
      gDoor.position.set(0, 1.2, 2.62);
      garage.add(gDoor);
      this._refs.garageDoor = gDoor;
      garage.position.set(-6.4, 0, 2.2);
      garage.rotation.y = 0.35;
      s.add(garage);

      // Tesla (low-poly)
      const tesla = new T.Group();
      const carBody = R(2.1, 0.45, 1.0, 0xd8dee9, { roughness: 0.15, metalness: 0.85 });
      carBody.position.y = 0.55;
      tesla.add(carBody);
      const cabin = R(1.05, 0.4, 0.8, 0x9fb3cc, { roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.85 });
      cabin.position.set(-0.15, 0.95, 0);
      tesla.add(cabin);
      const wheelMat = new T.MeshStandardMaterial({ color: 0x11151c, roughness: 0.9 });
      for (const [wx, wz] of [[-0.65, 0.42], [0.65, 0.42], [-0.65, -0.42], [0.65, -0.42]]) {
        const w = new T.Mesh(new T.CylinderGeometry(0.24, 0.24, 0.16, 12), wheelMat);
        w.rotation.x = Math.PI / 2;
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.24, wz);
        tesla.add(w);
      }
      // barra batteria (emissiva)
      const battBar = R(1.7, 0.06, 0.14, 0x0a3d1f, { emissive: 0x22ff88, emissiveIntensity: 0.5, roughness: 0.3 });
      battBar.position.set(0, 0.12, 0);
      tesla.add(battBar);
      // anello % sopra la macchina
      const battRing = new T.Mesh(new T.TorusGeometry(0.55, 0.05, 8, 40), matG(0x22ff88));
      battRing.rotation.x = Math.PI / 2;
      battRing.position.set(0, 1.9, 0);
      tesla.add(battRing);
      this._refs.tesla = tesla;
      this._refs.battBar = battBar;
      this._refs.battRing = battRing;
      tesla.position.set(-6.4, 0.5, 2.2);
      tesla.rotation.y = 0.35;
      s.add(tesla);

      // ---- GIARDINO (destra)
      const garden = new T.Group();
      const pad = new T.Mesh(new T.CylinderGeometry(3.4, 3.4, 0.25, 40), new T.MeshStandardMaterial({ color: 0x14532d, roughness: 0.9 }));
      pad.position.y = 0.02;
      pad.receiveShadow = true;
      garden.add(pad);
      // albero
      const trunk = new T.CylinderGeometry(0.22, 0.3, 1.6, 8);
      const trunkM = new T.Mesh(trunk, new T.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 1 }));
      trunkM.position.y = 0.8;
      garden.add(trunkM);
      const leafMat = new T.MeshStandardMaterial({ color: 0x1d7a3f, roughness: 0.85 });
      for (const [dx, dy, dz, r] of [[0.5, 2.0, 0, 0.85], [-0.4, 2.2, 0.3, 0.7], [0.1, 2.5, -0.2, 0.75]]) {
        const leaf = new T.Mesh(new T.SphereGeometry(r, 12, 10), leafMat);
        leaf.position.set(dx, dy, dz);
        leaf.castShadow = true;
        garden.add(leaf);
      }
      // palo luce giardino
      const pole = R(0.1, 2.6, 0.1, 0x8fa6c0, { metalness: 0.7, roughness: 0.3 });
      pole.position.set(-1.4, 1.3, 0.6);
      garden.add(pole);
      const lampG = new T.Mesh(new T.SphereGeometry(0.28, 12, 10), new T.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffcf5c, emissiveIntensity: 0.2, transparent: true, opacity: 0.95 }));
      lampG.position.set(-1.4, 2.7, 0.6);
      garden.add(lampG);
      this._refs.gardenLamp = lampG;
      // camera Ring giardino
      const camG = new T.Group();
      const camBody = R(0.3, 0.5, 0.3, 0x11151c, { roughness: 0.5 });
      camBody.position.y = 0.25;
      camG.add(camBody);
      const camLens = new T.Mesh(new T.SphereGeometry(0.12, 10, 8), new T.MeshStandardMaterial({ color: 0x0a1420, roughness: 0.1, metalness: 0.5 }));
      camLens.position.set(0, 0.25, 0.16);
      camG.add(camLens);
      const camLed = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), matG(0x22ff88));
      camLed.position.set(0.12, 0.42, 0.1);
      camG.add(camLed);
      camG.position.set(1.6, 1.35, -0.8);
      camG.rotation.y = 0.6;
      garden.add(camG);
      this._refs.gardenCam = camG;
      this._refs.gardenCamLed = camLed;
      garden.position.set(6.2, 0, -1.8);
      s.add(garden);
      this._garden = garden;
      this._refs.tree = trunkM;

      // ---- INGRESSO (davanti) con telecamera
      const entrance = new T.Group();
      const ePole = R(0.12, 2.3, 0.12, 0x8fa6c0, { metalness: 0.7, roughness: 0.3 });
      ePole.position.set(0.9, 1.15, 4.4);
      entrance.add(ePole);
      const eCam = R(0.34, 0.5, 0.34, 0x11151c, { roughness: 0.5 });
      eCam.position.set(0.9, 2.4, 4.4);
      entrance.add(eCam);
      const eLens = new T.Mesh(new T.SphereGeometry(0.13, 10, 8), new T.MeshStandardMaterial({ color: 0x0a1420, roughness: 0.1, metalness: 0.5 }));
      eLens.position.set(0.9, 2.4, 4.56);
      entrance.add(eLens);
      const eLed = new T.Mesh(new T.SphereGeometry(0.055, 8, 6), matG(0x22ff88));
      eLed.position.set(1.05, 2.58, 4.45);
      entrance.add(eLed);
      this._refs.entranceCam = eCam; this._refs.entranceLed = eLed;
      // luce ingresso
      const eLamp = new T.Mesh(new T.SphereGeometry(0.26, 12, 10), new T.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffcf5c, emissiveIntensity: 0.2, transparent: true, opacity: 0.95 }));
      eLamp.position.set(-0.9, 2.6, 4.2);
      entrance.add(eLamp);
      this._refs.entranceLamp = eLamp;
      // pietre
      for (const [dx, dz] of [[0.0, 3.4], [0.8, 3.6], [-0.7, 3.7]]) {
        const st = new T.Mesh(new T.BoxGeometry(0.4, 0.08, 0.4), new T.MeshStandardMaterial({ color: 0x64748b, roughness: 0.95 }));
        st.position.set(dx, 0.04, dz);
        entrance.add(st);
      }
      s.add(entrance);
      this._refs.entrance = entrance;

      // ---- meteo (elemento animato sopra la casa)
      const weather = new T.Group();
      const sunMesh = new T.Mesh(new T.SphereGeometry(1.1, 20, 16), new T.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffb020, emissiveIntensity: 0.9 }));
      sunMesh.position.set(0, 9.5, -5);
      weather.add(sunMesh);
      const sunRays = new T.Mesh(new T.RingGeometry(1.35, 1.75, 32), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.5, side: T.DoubleSide }));
      sunRays.position.copy(sunMesh.position);
      sunRays.rotation.x = Math.PI / 2;
      weather.add(sunRays);
      const cloudMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
      const clouds = [];
      for (const [cx, cy, cz, sc] of [[0, 8.6, -6.5, 1], [2.2, 9.0, -4.6, 0.7], [-2.0, 8.8, -5.2, 0.8]]) {
        const cl = new T.Group();
        for (const [bx, by, bz, br] of [[0, 0, 0, 0.5], [0.55, 0.1, 0, 0.4], [-0.55, 0.1, 0, 0.4], [0.2, 0.25, 0.1, 0.35]]) {
          const puff = new T.Mesh(new T.SphereGeometry(br, 10, 8), cloudMat);
          puff.position.set(bx, by, bz);
          cl.add(puff);
        }
        cl.position.set(cx, cy, cz);
        cl.scale.setScalar(sc);
        weather.add(cl); clouds.push(cl);
      }
      this._refs.weatherGroup = weather;
      this._refs.sun = sunMesh;
      this._refs.sunRays = sunRays;
      this._refs.clouds = clouds;
      s.add(weather);

      // ---- particelle (stelle fluttuanti)
      const starMat = new T.PointsMaterial({ color: 0x7fd4ff, size: 0.06, transparent: true, opacity: 0.7 });
      const starGeo = new T.BufferGeometry();
      const N = 220;
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 44;
        pos[i * 3 + 1] = Math.random() * 16 + 1;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 44;
      }
      starGeo.setAttribute("position", new T.BufferAttribute(pos, 3));
      const stars = new T.Points(starGeo, starMat);
      s.add(stars);
      this._stars = stars;
    }

    /* ---------- HUD ---------- */
    _buildHud() {
      const hud = this._hud;
      const chip = (label, id, extra = "") => {
        const c = document.createElement("div");
        c.style.cssText = `position:absolute;padding:10px 14px;border-radius:14px;background:rgba(13,27,46,0.55);backdrop-filter:blur(12px);border:1px solid rgba(0,217,255,0.25);box-shadow:0 8px 24px rgba(0,0,0,0.45);color:#e6f1ff;font:600 13px/1.4 system-ui,sans-serif;letter-spacing:0.2px;${extra}`;
        c.innerHTML = `<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#7fd4ff;margin-bottom:3px">${label}</div><div id="${id}" style="font-size:15px">…</div>`;
        hud.appendChild(c);
        return c;
      };
      const title = document.createElement("div");
      title.style.cssText = "position:absolute;top:14px;left:16px;color:#fff;font:800 18px system-ui,sans-serif;text-shadow:0 2px 12px rgba(0,0,0,0.6);display:flex;align-items:center;gap:8px;";
      title.innerHTML = `<span style="font-size:22px">🏠</span> Casa 3D <span style="font-size:11px;color:#7fd4ff;font-weight:600;background:rgba(0,217,255,0.12);padding:3px 8px;border-radius:20px;border:1px solid rgba(0,217,255,0.3)">LIVE</span>`;
      hud.appendChild(title);
      chip("Meteo", "hud-weather", "top:14px;right:16px;min-width:120px");
      chip("Tesla", "hud-tesla", "top:86px;right:16px;min-width:130px");
      chip("Telecamere", "hud-cams", "bottom:14px;right:16px;min-width:150px");
      chip("Luci", "hud-lights", "bottom:14px;left:16px;min-width:120px");
      chip("Lavanderia", "hud-laundry", "bottom:62px;left:16px;min-width:130px");
      const hint = document.createElement("div");
      hint.style.cssText = "position:absolute;bottom:14px;left:50%;transform:translateX(-50%);color:rgba(230,241,255,0.5);font:500 11px system-ui,sans-serif;letter-spacing:0.5px;";
      hint.textContent = "trascina per ruotare · clicca una luce per accenderla";
      hud.appendChild(hint);
      this._hudIds = {};
      ["hud-weather", "hud-tesla", "hud-cams", "hud-lights", "hud-laundry"].forEach(id => { this._hudIds[id] = hud.querySelector("#" + id); });
      // click su luci → toggle (solo chip luci: rendilo cliccabile)
      const lightsChip = hud.querySelector("#hud-lights").parentElement;
      lightsChip.style.pointerEvents = "auto";
      lightsChip.style.cursor = "pointer";
      lightsChip.title = "Clicca per accendere/spegnere le luci";
      lightsChip.addEventListener("click", () => this._toggleLights());
    }

    /* ---------- LOOP ---------- */
    _startLoop(T) {
      const loop = () => {
        this._t += 0.016;
        const t = this._t;
        // rotazione automatica lenta se non si trascina
        if (!this._drag.active) this._drag.ry += 0.0022;
        const grp = this._house;
        if (grp) {
          this._camera.position.x = 20 * Math.sin(this._drag.ry);
          this._camera.position.z = 20 * Math.cos(this._drag.ry);
          this._camera.position.y = 10 + 8 * Math.sin(this._drag.rx);
          this._camera.lookAt(0, 1.8, 0);
        }
        // anelli rotanti
        if (this._refs.ring1) { this._refs.ring1.rotation.z = t * 0.25; }
        if (this._refs.ring2) { this._refs.ring2.rotation.z = -t * 0.35; }
        // antenna blink
        if (this._refs.antenna) this._refs.antenna.material.emissiveIntensity = 1.2 + Math.sin(t * 5) * 0.9;
        // nuvole
        (this._refs.clouds || []).forEach((c, i) => { c.position.x += 0.004 * (i + 1); if (c.position.x > 6) c.position.x = -6; });
        // raggi sole
        if (this._refs.sunRays) this._refs.sunRays.rotation.z += 0.004;
        // stelle
        if (this._stars) this._stars.rotation.y += 0.0004;
        // pulsazione LED cam
        const pulse = 1.2 + Math.sin(t * 3.5) * 0.8;
        [this._refs.gardenCamLed, this._refs.entranceLed].forEach(l => { if (l) l.material.emissiveIntensity = pulse; });
        // glow ambientale
        if (this._glowLight) this._glowLight.intensity = 0.7 + Math.sin(t * 1.2) * 0.15;
        this._renderer.render(this._scene, this._camera);
        this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
    }

    /* ---------- STATI ---------- */
    _updateStates() {
      if (!this._hass || !this._refs.windows) return;
      const h = this._hass;
      const set = (id, el, mat, on, off) => {
        const st = ST(h, id);
        return st === "on" || st === "playing" || st === "home" || st === "recording" ? on() : off();
      };

      // luci
      const lightEnts = this._cfg.lights || ["light.ingresso_principale_luce", "light.giardino_luce"];
      let onCount = 0;
      const setWindow = (win, on) => {
        win.material.emissive = on ? 0xffb020 : 0x000000;
        win.material.emissiveIntensity = on ? 2.2 : 0;
        win.material.color.set(on ? 0xfff6d8 : 0x10233c);
      };
      lightEnts.forEach((id, i) => {
        const on = ST(h, id) === "on";
        if (on) onCount++;
        if (this._refs.windows[i]) setWindow(this._refs.windows[i], on);
      });
      // luce giardino
      const gOn = ST(h, "light.giardino_luce") === "on";
      if (this._refs.gardenLamp) { this._refs.gardenLamp.material.emissiveIntensity = gOn ? 3 : 0.2; }
      // luce ingresso
      const eOn = ST(h, "light.ingresso_principale_luce") === "on";
      if (this._refs.entranceLamp) { this._refs.entranceLamp.material.emissiveIntensity = eOn ? 3 : 0.2; }
      this._setHud("hud-lights", `${onCount}/${lightEnts.length} accese`);

      // TV soggiorno
      const tvState = ST(h, "media_player.salotto_salotto_tv_55", "unavailable");
      const tvOn = tvState === "playing" || tvState === "on";
      if (this._refs.tvWin) {
        this._refs.tvWin.material.emissive = tvOn ? 0x1a5cff : 0x000000;
        this._refs.tvWin.material.emissiveIntensity = tvOn ? 2.5 : 0;
      }

      // Tesla
      const batt = NUM(ST(h, "sensor.hodl_battery_level", "0"), 0);
      const charging = ST(h, "binary_sensor.hodl_status") === "on";
      if (this._refs.battBar) {
        const frac = Math.max(0.02, Math.min(1, batt / 100));
        this._refs.battBar.scale.x = frac;
        this._refs.battBar.material.emissive = charging ? 0x22ff88 : (batt < 20 ? 0xff4455 : 0x22ccff);
        this._refs.battBar.material.emissiveIntensity = charging ? 2.6 : 1.2;
      }
      if (this._refs.battRing) {
        this._refs.battRing.material.emissive = charging ? 0x22ff88 : 0x22ccff;
        this._refs.battRing.material.emissiveIntensity = charging ? 2.4 : 1.0;
        // porta garage aperta se in ricarica
      }
      if (this._refs.garageDoor) {
        const target = charging ? 1.9 : 0;
        this._refs.garageDoor.position.y += (target - this._refs.garageDoor.position.y) * 0.05;
        this._refs.garageDoor.material.opacity = charging ? 0.35 : 0.95;
      }
      const pw = NUM(ST(h, "sensor.hodl_charger_power", "0"), 0);
      this._setHud("hud-tesla", `${batt}% ${charging ? "· in carica " + pw + " kW" : "· ferma"}`);

      // telecamere
      const cams = this._cfg.cameras || ["camera.ingresso_principale_live_view", "camera.giardino_live_view", "camera.piano_di_sopra_live_view"];
      let active = 0; const warns = [];
      cams.forEach((id) => { if (ST(h, id) === "recording" || ST(h, id) === "streaming") active++; });
      const b1 = NUM(ST(h, "sensor.giardino_batteria", "100"), 100);
      if (b1 <= 10) warns.push("giardino " + b1 + "%");
      this._setHud("hud-cams", `${active} attive · ${warns.length ? "⚠ " + warns.join(", ") : "tutte ok"}`);

      // meteo
      const w = ST(h, "weather.forecast_casa", "unknown");
      const icons = { "clear-night": "🌙", sunny: "☀️", clear: "☀️", partlycloudy: "⛅", cloudy: "☁️", fog: "🌫️", rainy: "🌧️", pouring: "🌧️", snowy: "❄️", lightning: "⛈️" };
      this._setHud("hud-weather", `${icons[w] || "🌡️"} ${w.replace(/_/g, " ")}`);
      // sole/nuvole visibili
      if (this._refs.sun) {
        const night = w === "clear-night";
        const sunny = w === "sunny" || w === "clear";
        this._refs.sun.visible = !night;
        this._refs.sunRays.visible = sunny;
        (this._refs.clouds || []).forEach(c => { c.visible = w !== "clear-night" && w !== "sunny" && w !== "clear"; });
      }

      // lavanderia
      const lw = NUM(ST(h, "sensor.lavanderia_lavatrice_energia", "0"), 0);
      const dw = NUM(ST(h, "sensor.lavanderia_dryer_energia", "0"), 0);
      this._setHud("hud-laundry", `Lav ${lw.toFixed(1)} kWh · Asc ${dw.toFixed(1)} kWh`);

      // persona
      const home = ST(h, "person.tito") === "home";
      if (this._refs.door) this._refs.door.material.emissive = home ? 0x22ff88 : 0x000000;
      if (this._refs.door) this._refs.door.material.emissiveIntensity = home ? 0.8 : 0;
    }

    _setHud(id, text) { const el = this._hudIds && this._hudIds[id]; if (el) el.textContent = text; }

    async _toggleLights() {
      const h = this._hass;
      if (!h) return;
      const ids = this._cfg.lights || ["light.ingresso_principale_luce", "light.giardino_luce"];
      for (const id of ids) {
        const on = ST(h, id) === "on";
        try { await h.callService("light", on ? "turn_off" : "turn_on", { entity_id: id }); } catch (e) { console.warn(e); }
      }
    }
  }

  customElements.define("ha-3d-card", Ha3dCard);
})();
