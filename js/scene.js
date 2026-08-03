import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

(function () {
  'use strict';

  var canvas = document.getElementById('webgl-scene');
  if (!canvas) return;

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isSmall = window.innerWidth < 760;

  function webglAvailable() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  function bail() {
    canvas.style.display = 'none';
    var lc = document.getElementById('link-canvas');
    if (lc) lc.style.display = 'none';
    document.body.classList.remove('webgl-active');
    if (window.NuevoParticleFallback) window.NuevoParticleFallback();
  }

  if (!webglAvailable()) { bail(); return; }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (err) { bail(); return; }

  document.body.classList.add('webgl-active');

  /* ---------- palette ---------- */
  var TH = {
    space: 0x050b1a,
    fogDensity: 0.011,
    star: 0x6f86a8,
    starOpacity: 0.5,
    blending: THREE.AdditiveBlending,
    nodeAlpha: 1,
    lineAlpha: 1,
    tetherAlpha: 1,
    hues: {
      teal: 0x5fb8cc, tealDeep: 0x1f6b7a, violet: 0x8b6bf0,
      magenta: 0xd162e0, dim: 0x4a5a76, warn: 0xd97a63
    }
  };

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(TH.space);
  scene.fog = new THREE.FogExp2(TH.space, TH.fogDensity);

  function viewW() { return document.documentElement.clientWidth || window.innerWidth; }
  function viewH() { return document.documentElement.clientHeight || window.innerHeight; }

  var camera = new THREE.PerspectiveCamera(55, viewW() / viewH(), 0.1, 500);

  var composer = null;
  var bloomPass = null;

  function setSize() {
    var w = viewW(), h = viewH();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // With the bloom chain active every pixel is rendered several times over,
    // so cap the ratio lower — the bloom blur hides the resolution drop.
    var maxRatio = composer ? 1.2 : (isSmall ? 1.5 : 2);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxRatio));
    // updateStyle=false: CSS owns the layout size.
    renderer.setSize(w, h, false);
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    }
  }
  setSize();

  // Post-processing bloom — real light spill around every glowing node.
  // Desktop only: the bloom chain is several extra render targets, which
  // low-end mobile GPUs pay dearly for. Failure is non-fatal: we just render
  // the plain scene.
  if (!isSmall) {
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      // Half-resolution bloom targets: the effect is a blur anyway, and this
      // roughly quarters the bloom chain's fill cost.
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(viewW() / 2, viewH() / 2),
        0.55,  // strength
        0.7,   // radius
        0.18   // threshold
      );
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
      setSize();
    } catch (err) {
      composer = null;
      bloomPass = null;
    }
  }

  function hue(key) { return TH.hues[key]; }

  /* ---------- soft radial-glow sprite texture, shared by every node/particle ---------- */
  var GLOW_TEX = (function () {
    var size = 128;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    var tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }());

  /* ---------- ambient starfield ---------- */
  var STAR_COUNT = isSmall ? 480 : 1300;
  var starGeo = new THREE.BufferGeometry();
  var starPos = new Float32Array(STAR_COUNT * 3);
  for (var s = 0; s < STAR_COUNT; s++) {
    starPos[s * 3] = (Math.random() - 0.5) * 240;
    starPos[s * 3 + 1] = (Math.random() - 0.5) * 150;
    starPos[s * 3 + 2] = (Math.random() - 0.5) * 280 - 60;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  var starMat = new THREE.PointsMaterial({
    size: 0.6, color: TH.star, transparent: true, opacity: TH.starOpacity,
    sizeAttenuation: true, depthWrite: false
  });
  var stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  /* ---------- hero energy core ----------
     A slowly tumbling double wireframe at the camera's opening look-target —
     the "machine" the whole network hangs off. Bloom turns its edges into
     light. */
  var coreGroup = new THREE.Group();
  coreGroup.position.set(0, 0, -4);
  var coreOuter = new THREE.Mesh(
    new THREE.IcosahedronGeometry(6, 1),
    new THREE.MeshBasicMaterial({
      color: 0x5fb8cc, wireframe: true, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  var coreInner = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.2, 0),
    new THREE.MeshBasicMaterial({
      color: 0x8b6bf0, wireframe: true, transparent: true, opacity: 0.24,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  coreGroup.add(coreOuter);
  coreGroup.add(coreInner);
  scene.add(coreGroup);

  /* ---------- shooting stars ---------- */
  var METEOR_SLOTS = isSmall ? 2 : 4;
  var meteors = [];
  for (var mt = 0; mt < METEOR_SLOTS; mt++) {
    var mGeo = new THREE.BufferGeometry();
    mGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    var mMat = new THREE.LineBasicMaterial({
      color: 0xbfeaff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    var mLine = new THREE.Line(mGeo, mMat);
    scene.add(mLine);
    meteors.push({ geo: mGeo, mat: mMat, active: false, p0: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, dur: 0 });
  }

  var _mHead = new THREE.Vector3();
  var _mTail = new THREE.Vector3();

  function updateMeteors(dt) {
    for (var i = 0; i < meteors.length; i++) {
      var m = meteors[i];
      if (!m.active) {
        if (Math.random() < 0.006) {
          m.p0.set(
            camera.position.x + (Math.random() - 0.5) * 90,
            camera.position.y + 12 + Math.random() * 18,
            camera.position.z - 35 - Math.random() * 60
          );
          m.v.set((Math.random() - 0.5) * 34, -(14 + Math.random() * 22), (Math.random() - 0.5) * 10);
          m.life = 0;
          m.dur = 0.9 + Math.random() * 0.7;
          m.active = true;
        }
        continue;
      }
      m.life += dt;
      if (m.life >= m.dur) { m.active = false; m.mat.opacity = 0; continue; }
      _mHead.copy(m.p0).addScaledVector(m.v, m.life);
      _mTail.copy(_mHead).addScaledVector(m.v, -0.18);
      var attr = m.geo.attributes.position;
      attr.setXYZ(0, _mTail.x, _mTail.y, _mTail.z);
      attr.setXYZ(1, _mHead.x, _mHead.y, _mHead.z);
      attr.needsUpdate = true;
      m.mat.opacity = Math.sin((m.life / m.dur) * Math.PI) * 0.85;
    }
  }

  /* ---------- registries so a theme swap can recolour everything ---------- */
  var animated = [];   // sprites with pulse/drift
  var flowEdges = [];  // { curve, hue }

  function addNode(pos, hueKey, scale, opts) {
    opts = opts || {};
    var baseOpacity = opts.opacity != null ? opts.opacity : 0.95;
    var mat = new THREE.SpriteMaterial({
      map: GLOW_TEX, color: hue(hueKey), transparent: true,
      opacity: baseOpacity * TH.nodeAlpha,
      blending: TH.blending, depthWrite: false
    });
    var sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.scale.setScalar(scale);
    scene.add(sprite);
    if (opts.pulse || opts.drift) {
      animated.push({
        sprite: sprite, base: pos.clone(), baseScale: scale,
        pulse: !!opts.pulse, pulseSpeed: 0.5 + Math.random() * 0.5, pulsePhase: Math.random() * Math.PI * 2,
        drift: !!opts.drift, driftR: opts.driftR || 1.2, driftSpeed: 0.12 + Math.random() * 0.18, driftPhase: Math.random() * Math.PI * 2
      });
    }
    return sprite;
  }

  var EDGE_SEG = 20;
  var edgeRecs = [];
  var _ep = new THREE.Vector3();

  // `a` and `b` are live position vectors (usually a sprite's own .position).
  // Nodes drift, so both the curve and the drawn line have to be rebuilt each
  // frame — otherwise the line stays where the node used to be and visibly
  // detaches from its star.
  function addEdge(a, b, hueKey, opacity, bow) {
    var bowOff = new THREE.Vector3(
      (Math.random() - 0.5) * bow, (Math.random() - 0.5) * bow, (Math.random() - 0.5) * bow
    );
    var curve = new THREE.CatmullRomCurve3([
      a.clone(), a.clone().lerp(b, 0.5).add(bowOff), b.clone()
    ]);
    var geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(EDGE_SEG));
    var mat = new THREE.LineBasicMaterial({
      color: hue(hueKey), transparent: true,
      opacity: Math.min(opacity * TH.lineAlpha, 1),
      blending: TH.blending, depthWrite: false
    });
    scene.add(new THREE.Line(geo, mat));
    edgeRecs.push({ curve: curve, geo: geo, a: a, b: b, bow: bowOff });
    flowEdges.push({ curve: curve, hue: hueKey });
    return curve;
  }

  function updateEdges() {
    for (var i = 0; i < edgeRecs.length; i++) {
      var rec = edgeRecs[i];
      var pts = rec.curve.points;
      pts[0].copy(rec.a);
      pts[2].copy(rec.b);
      pts[1].copy(rec.a).lerp(rec.b, 0.5).add(rec.bow);

      var attr = rec.geo.attributes.position;
      for (var s = 0; s <= EDGE_SEG; s++) {
        rec.curve.getPoint(s / EDGE_SEG, _ep);
        attr.setXYZ(s, _ep.x, _ep.y, _ep.z);
      }
      attr.needsUpdate = true;
    }
  }

  /* ---------- narrative layout ---------- */
  var v3 = function (x, y, z) { return new THREE.Vector3(x, y, z); };

  // Large soft washes drifting through the flight path — atmosphere.
  var NEBULA_DEPTHS = [-8, -50, -92, -128, -168];
  for (var nb = 0; nb < NEBULA_DEPTHS.length; nb++) {
    addNode(
      v3((nb % 2 ? 1 : -1) * (14 + nb * 3), (nb % 2 ? -1 : 1) * 6, NEBULA_DEPTHS[nb]),
      nb % 2 ? 'violet' : 'tealDeep',
      isSmall ? 42 : 60,
      { opacity: 0.13, drift: true, driftR: 6 + nb }
    );
  }

  // A loose field of drifting nodes the whole length of the journey, so the
  // space between sections is never empty.
  var FIELD_COUNT = isSmall ? 22 : 48;
  var FIELD_HUES = ['teal', 'tealDeep', 'violet', 'magenta', 'dim'];
  for (var f = 0; f < FIELD_COUNT; f++) {
    var fz = -8 - Math.random() * 190;
    var fp = v3((Math.random() - 0.5) * 56, (Math.random() - 0.5) * 34, fz);
    addNode(fp, FIELD_HUES[(Math.random() * FIELD_HUES.length) | 0], 0.5 + Math.random() * 0.7,
      { opacity: 0.35 + Math.random() * 0.35, drift: true, driftR: 1.6 + Math.random() * 2.4 });
  }

  // Problem: scattered, dim, disconnected cluster.
  var problemCenter = v3(10, -2, -10);
  for (var p = 0; p < 12; p++) {
    var pp = problemCenter.clone().add(v3((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 22));
    addNode(pp, Math.random() > 0.6 ? 'warn' : 'dim', 0.9 + Math.random() * 0.8, { drift: true, driftR: 1.4 });
  }

  // OrcaFlo: bright hub with orbiting feature satellites, all wired in.
  var hubPos = v3(0, 1, -40);
  addNode(hubPos, 'teal', 3.4, { pulse: true });
  var satCount = 8;
  for (var i = 0; i < satCount; i++) {
    var ang = (i / satCount) * Math.PI * 2;
    var sat = hubPos.clone().add(v3(Math.cos(ang) * 9.5, Math.sin(ang * 1.7) * 2.4, Math.sin(ang) * 9.5));
    var satSprite = addNode(sat, 'tealDeep', 1.1, { drift: true, driftR: 1 });
    addEdge(hubPos, satSprite.position, 'teal', 0.35, 3);
  }

  // Automate: hub branching into automation categories.
  var branchHub = v3(-6, 0, -72);
  addNode(branchHub, 'violet', 2.4, { pulse: true });
  var branchHues = ['teal', 'violet', 'magenta', 'tealDeep', 'violet', 'magenta'];
  for (var b = 0; b < branchHues.length; b++) {
    var bAng = (b / branchHues.length) * Math.PI * 2 + 0.4;
    var bEnd = branchHub.clone().add(v3(Math.cos(bAng) * 13, (Math.random() - 0.5) * 7, Math.sin(bAng) * 13));
    var bSprite = addNode(bEnd, branchHues[b], 1, { drift: true, driftR: 1.1 });
    addEdge(branchHub, bSprite.position, branchHues[b], 0.3, 4);
  }

  // Results: an ascending run of nodes — revenue climbing.
  var growthCenter = v3(4, 3, -96);
  var growthNodes = [];
  for (var g = 0; g < 6; g++) {
    var gp = growthCenter.clone().add(v3(-14 + g * 5.6, -7 + g * 2.9, Math.sin(g * 1.3) * 3));
    growthNodes.push(addNode(gp, g > 3 ? 'teal' : 'tealDeep', 1 + g * 0.22, { drift: true, driftR: 0.7 }));
  }
  for (var g2 = 0; g2 < growthNodes.length - 1; g2++) {
    addEdge(growthNodes[g2].position, growthNodes[g2 + 1].position, 'teal', 0.4, 1.2);
  }

  // Calm ring behind pricing / partners.
  var ringCenter = v3(0, 1, -134);
  var ringCount = 10;
  var ringNodes = [];
  for (var r2 = 0; r2 < ringCount; r2++) {
    var rAng = (r2 / ringCount) * Math.PI * 2;
    var rp = ringCenter.clone().add(v3(Math.cos(rAng) * 20, Math.sin(rAng * 2) * 3, Math.sin(rAng) * 20 - 10));
    ringNodes.push(addNode(rp, r2 % 2 ? 'tealDeep' : 'violet', 1, { drift: true, driftR: 0.8 }));
  }
  for (var r3 = 0; r3 < ringCount; r3++) {
    addEdge(ringNodes[r3].position, ringNodes[(r3 + 1) % ringCount].position, 'tealDeep', 0.16, 2);
  }

  // Contact: a single node to arrive at.
  addNode(v3(0, 0, -182), 'teal', 3.2, { pulse: true });

  /* ---------- flowing data particles along every edge ---------- */
  var PER_EDGE = isSmall ? 3 : 5;
  var flowMeta = [];
  var flowGeo = new THREE.BufferGeometry();
  var flowCount = flowEdges.length * PER_EDGE;
  var flowPos = new Float32Array(flowCount * 3);
  var flowColor = new Float32Array(flowCount * 3);
  for (var e = 0; e < flowEdges.length; e++) {
    for (var fp2 = 0; fp2 < PER_EDGE; fp2++) {
      flowMeta.push({ edge: e, phase: fp2 / PER_EDGE + Math.random() * 0.1, speed: 0.05 + Math.random() * 0.04 });
    }
  }
  flowGeo.setAttribute('position', new THREE.BufferAttribute(flowPos, 3));
  flowGeo.setAttribute('color', new THREE.BufferAttribute(flowColor, 3));
  var flowMat = new THREE.PointsMaterial({
    size: 1.4, vertexColors: true, map: GLOW_TEX, transparent: true,
    blending: TH.blending, depthWrite: false, sizeAttenuation: true
  });
  if (flowCount) scene.add(new THREE.Points(flowGeo, flowMat));

  var _c = new THREE.Color();
  function paintFlowColors() {
    if (!flowCount) return;
    var attr = flowGeo.attributes.color;
    for (var m = 0; m < flowMeta.length; m++) {
      _c.setHex(hue(flowEdges[flowMeta[m].edge].hue));
      attr.setXYZ(m, _c.r, _c.g, _c.b);
    }
    attr.needsUpdate = true;
  }
  paintFlowColors();

  function updateFlow(elapsed) {
    if (!flowCount) return;
    var attr = flowGeo.attributes.position;
    for (var m = 0; m < flowMeta.length; m++) {
      var meta = flowMeta[m];
      var t = (elapsed * meta.speed + meta.phase) % 1;
      var pt = flowEdges[meta.edge].curve.getPointAt(t);
      attr.setXYZ(m, pt.x, pt.y, pt.z);
    }
    attr.needsUpdate = true;
  }

  /* ---------- occasional bright bursts zipping along an edge ---------- */
  var BURST_SLOTS = isSmall ? 4 : 8;
  var burstPool = [];
  for (var bi = 0; bi < BURST_SLOTS; bi++) {
    var bMat = new THREE.SpriteMaterial({
      map: GLOW_TEX, color: hue('teal'), transparent: true, opacity: 0,
      blending: TH.blending, depthWrite: false
    });
    var bSprite = new THREE.Sprite(bMat);
    bSprite.scale.setScalar(2.3);
    scene.add(bSprite);
    burstPool.push({ sprite: bSprite, mat: bMat, active: false, edge: null, start: 0, dur: 0 });
  }

  function updateBursts(elapsed) {
    if (!flowEdges.length) return;
    for (var i = 0; i < burstPool.length; i++) {
      var bst = burstPool[i];
      if (!bst.active) {
        if (Math.random() < 0.004) {
          bst.edge = flowEdges[(Math.random() * flowEdges.length) | 0];
          bst.start = elapsed;
          bst.dur = 1 + Math.random() * 0.8;
          bst.active = true;
          bst.mat.color.setHex(hue(bst.edge.hue));
        }
        continue;
      }
      var t = (elapsed - bst.start) / bst.dur;
      if (t >= 1) { bst.active = false; bst.mat.opacity = 0; continue; }
      bst.sprite.position.copy(bst.edge.curve.getPointAt(Math.min(Math.max(t, 0), 1)));
      bst.mat.opacity = Math.sin(Math.min(t, 1) * Math.PI) * 0.95;
    }
  }

  /* ---------- info-box tethers: every card gets its own companion star ---------- */
  var linkCanvas = document.getElementById('link-canvas');
  var linkCtx = linkCanvas ? linkCanvas.getContext('2d') : null;
  var links = [];

  var LINK_GROUPS = [
    { sel: '#problem .card',        hue: 'warn' },
    { sel: '#orcaflo .feature',     hue: 'teal' },
    { sel: '#automate .who-card',   hue: 'violet' },
    { sel: '#results .leak-card',   hue: 'teal' },
    { sel: '#pricing .price-card',  hue: 'magenta' }
  ];

  if (linkCtx) {
    LINK_GROUPS.forEach(function (group) {
      var els = document.querySelectorAll(group.sel);
      for (var gi = 0; gi < els.length; gi++) {
        var star = addNode(v3(0, 0, 0), group.hue, 1.5, { pulse: true });
        star.visible = false;
        links.push({
          el: els[gi], star: star, hue: group.hue, visible: false,
          onScreen: false, sx: 0, sy: 0, rect: null,
          // Golden-angle fan so neighbouring cards send tethers in clearly
          // different directions instead of bunching up.
          ang: gi * 2.39996,
          gap: 44 + (gi % 3) * 30,
          depth: 17 + (gi % 4) * 3.5
        });
      }
    });

    // Only measure boxes actually on screen — keeps per-frame layout reads to a
    // handful and stays correct through the reveal animations.
    if ('IntersectionObserver' in window) {
      var linkIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          for (var li = 0; li < links.length; li++) {
            if (links[li].el === entry.target) { links[li].visible = entry.isIntersecting; break; }
          }
        });
      }, { rootMargin: '10% 0px 10% 0px' });
      links.forEach(function (l) { linkIO.observe(l.el); });
    } else {
      links.forEach(function (l) { l.visible = true; });
    }
  }

  var _unproj = new THREE.Vector3();

  // Anchor each card's star to a point near that card on screen, then push it
  // into the scene at `depth` so it lives in 3D (glow, fog, pulse, parallax)
  // while reliably sitting beside the box it belongs to.
  function positionLinkStars() {
    if (!linkCtx) return;
    var W = viewW(), H = viewH();

    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      link.onScreen = false;
      if (!link.visible) { link.star.visible = false; continue; }

      var r = link.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > H) { link.star.visible = false; continue; }

      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      // Push the star clear of the box's half-diagonal so it never ends up
      // hidden behind the glass it's tethered to.
      var dist = Math.hypot(r.width, r.height) / 2 + link.gap;
      var tx = cx + Math.cos(link.ang) * dist;
      var ty = cy + Math.sin(link.ang) * dist;

      tx = Math.min(Math.max(tx, 54), W - 54);
      ty = Math.min(Math.max(ty, 76), H - 76);

      link.sx = tx; link.sy = ty; link.rect = r; link.onScreen = true;

      _unproj.set((tx / W) * 2 - 1, -((ty / H) * 2 - 1), 0.5).unproject(camera);
      _unproj.sub(camera.position).normalize().multiplyScalar(link.depth).add(camera.position);
      link.star.position.copy(_unproj);
      link.star.visible = true;
    }
  }

  function sizeLinkCanvas() {
    if (!linkCanvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Backing store only — CSS owns the layout size.
    linkCanvas.width = viewW() * dpr;
    linkCanvas.height = viewH() * dpr;
    linkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  if (linkCtx) sizeLinkCanvas();

  function drawLinks(elapsed) {
    if (!linkCtx) return;
    var W = viewW(), H = viewH();
    linkCtx.clearRect(0, 0, W, H);

    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      if (!link.onScreen) continue;

      var sx = link.sx, sy = link.sy, r = link.rect;
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      var dx = sx - cx, dy = sy - cy;
      var dist = Math.hypot(dx, dy);
      if (dist < 40) continue;

      // Walk from the box centre out to its border so the line starts at the edge.
      var hw = r.width / 2, hh = r.height / 2;
      var tEdge = Math.min(hw / Math.abs(dx || 0.0001), hh / Math.abs(dy || 0.0001));
      var ex = cx + dx * tEdge, ey = cy + dy * tEdge;

      var alpha = Math.max(0, 1 - dist / (Math.max(W, H) * 0.95)) * TH.tetherAlpha;
      alpha = Math.min(alpha, 1);
      if (alpha <= 0.02) continue;

      _c.setHex(hue(link.hue));
      var rgb = Math.round(_c.r * 255) + ',' + Math.round(_c.g * 255) + ',' + Math.round(_c.b * 255);

      // Stay visible right at the card edge — fading to zero here made the
      // tether look detached from the box it belongs to.
      var grad = linkCtx.createLinearGradient(ex, ey, sx, sy);
      grad.addColorStop(0, 'rgba(' + rgb + ',' + (alpha * 0.7).toFixed(3) + ')');
      grad.addColorStop(1, 'rgba(' + rgb + ',' + alpha.toFixed(3) + ')');

      linkCtx.save();
      linkCtx.shadowColor = 'rgba(' + rgb + ',' + (alpha * 0.9).toFixed(3) + ')';
      linkCtx.shadowBlur = 7;
      linkCtx.beginPath();
      linkCtx.moveTo(ex, ey);
      linkCtx.lineTo(sx, sy);
      linkCtx.strokeStyle = grad;
      linkCtx.lineWidth = 1.7;
      linkCtx.stroke();
      linkCtx.restore();

      // A packet of light running the length of the tether.
      var tp = ((elapsed * 0.35) + i * 0.19) % 1;
      var px = ex + (sx - ex) * tp, py = ey + (sy - ey) * tp;
      var pulseA = Math.sin(tp * Math.PI) * alpha;
      if (pulseA > 0.02) {
        linkCtx.save();
        linkCtx.shadowColor = 'rgba(' + rgb + ',' + pulseA.toFixed(3) + ')';
        linkCtx.shadowBlur = 9;
        linkCtx.beginPath();
        linkCtx.arc(px, py, 2.6, 0, Math.PI * 2);
        linkCtx.fillStyle = 'rgba(' + rgb + ',' + pulseA.toFixed(3) + ')';
        linkCtx.fill();
        linkCtx.restore();
      }

      // Ring where the tether meets the star.
      linkCtx.beginPath();
      linkCtx.arc(sx, sy, 4.2, 0, Math.PI * 2);
      linkCtx.strokeStyle = 'rgba(' + rgb + ',' + (alpha * 0.85).toFixed(3) + ')';
      linkCtx.lineWidth = 1.3;
      linkCtx.stroke();
    }
  }

  /* ---------- camera flight path, one waypoint per section ---------- */
  var stationEls = [
    document.querySelector('.hero'),
    document.getElementById('problem'),
    document.getElementById('orcaflo'),
    document.getElementById('automate'),
    document.getElementById('results'),
    document.getElementById('pricing'),
    document.getElementById('partners'),
    document.getElementById('contact')
  ];

  var CAM_POINTS = [
    v3(0, 1.5, 34), v3(16, -3, 6), v3(0, 3, -26), v3(-14, 1, -58),
    v3(13, -2, -80), v3(-8, 5, -106), v3(6, -1, -136), v3(0, 1, -166)
  ];
  var LOOK_POINTS = [
    v3(0, 0, 0), problemCenter, hubPos, branchHub,
    growthCenter, v3(2, 1, -120), v3(-1, 1, -150), v3(0, 0, -182)
  ];
  var camCurve = new THREE.CatmullRomCurve3(CAM_POINTS);
  var lookCurve = new THREE.CatmullRomCurve3(LOOK_POINTS);

  var breakpoints = [];
  function computeBreakpoints() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    breakpoints = stationEls.map(function (el) {
      if (!el || max <= 0) return 0;
      var top = el.getBoundingClientRect().top + window.scrollY;
      return Math.min(Math.max(top / max, 0), 1);
    });
    // Guard against ties so the piecewise lookup below stays monotonic.
    for (var i = 1; i < breakpoints.length; i++) {
      if (breakpoints[i] <= breakpoints[i - 1]) breakpoints[i] = breakpoints[i - 1] + 0.0001;
    }
  }
  computeBreakpoints();

  // Maps a raw 0..1 scroll fraction onto the 0..1 curve parameter using each
  // section's real scroll position, so the camera arrives when its section does.
  function mapT(rawT) {
    var n = breakpoints.length;
    for (var i = 0; i < n - 1; i++) {
      var a = breakpoints[i], b = breakpoints[i + 1];
      if (rawT <= b || i === n - 2) {
        var local = b > a ? (rawT - a) / (b - a) : 0;
        local = Math.min(Math.max(local, 0), 1);
        return (i + local) / (n - 1);
      }
    }
    return 1;
  }

  function getScrollT() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
  }

  var mouseX = 0, mouseY = 0;
  var trail = []; // cursor comet, drawn on the link canvas
  if (!prefersReducedMotion) {
    window.addEventListener('mousemove', function (e) {
      mouseX = e.clientX / window.innerWidth - 0.5;
      mouseY = e.clientY / window.innerHeight - 0.5;
      trail.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (trail.length > 36) trail.shift();
    }, { passive: true });
  }

  var TRAIL_MS = 520;

  function drawTrail() {
    if (!linkCtx || trail.length < 2) return;
    var now = performance.now();
    while (trail.length && now - trail[0].t > TRAIL_MS) trail.shift();
    for (var i = 1; i < trail.length; i++) {
      var a = trail[i - 1], b = trail[i];
      var age = (now - b.t) / TRAIL_MS;
      var fade = (1 - age) * (i / trail.length);
      if (fade <= 0.02) continue;
      linkCtx.beginPath();
      linkCtx.moveTo(a.x, a.y);
      linkCtx.lineTo(b.x, b.y);
      linkCtx.strokeStyle = 'rgba(95,184,204,' + (fade * 0.55).toFixed(3) + ')';
      linkCtx.lineWidth = 0.5 + fade * 2.2;
      linkCtx.lineCap = 'round';
      linkCtx.stroke();
    }
  }

  var smoothT = getScrollT();
  var scrollVel = 0;      // smoothed px/s — drives FOV kick, banking, streaks
  var lastScrollY = window.scrollY;

  function render(t, elapsed, dt) {
    var pathT = mapT(t);
    var pos = camCurve.getPointAt(pathT);
    var look = lookCurve.getPointAt(pathT);

    // Speed-reactive camera: fast scrolling widens the FOV (warp-drive kick)
    // and banks the camera into the move like a craft rolling into a turn.
    var speed = Math.abs(scrollVel);
    camera.fov = 55 + Math.min(speed * 0.0035, 11);
    camera.position.set(pos.x + mouseX * 2.2, pos.y - mouseY * 1.4, pos.z);
    camera.lookAt(look.x + mouseX * 1.2, look.y - mouseY * 0.8, look.z);
    camera.rotateZ(Math.max(-0.05, Math.min(0.05, scrollVel * 0.000014)));

    stars.rotation.y = elapsed * 0.004;
    starMat.opacity = TH.starOpacity + Math.sin(elapsed * 0.6) * 0.08;
    // Stars swell with speed — reads as light streaking past.
    starMat.size = 0.6 + Math.min(speed * 0.0004, 1.5);

    coreGroup.rotation.y = elapsed * 0.14;
    coreGroup.rotation.x = Math.sin(elapsed * 0.23) * 0.35;
    coreInner.rotation.y = -elapsed * 0.3;
    coreInner.rotation.z = elapsed * 0.19;

    updateMeteors(dt);

    for (var i = 0; i < animated.length; i++) {
      var a = animated[i];
      if (a.drift) {
        a.sprite.position.set(
          a.base.x + Math.sin(elapsed * a.driftSpeed + a.driftPhase) * a.driftR,
          a.base.y + Math.cos(elapsed * a.driftSpeed * 0.8 + a.driftPhase) * a.driftR * 0.7,
          a.base.z + Math.sin(elapsed * a.driftSpeed * 0.6 + a.driftPhase + 1) * a.driftR * 0.5
        );
      }
      if (a.pulse) {
        a.sprite.scale.setScalar(a.baseScale * (1 + Math.sin(elapsed * a.pulseSpeed + a.pulsePhase) * 0.12));
      }
    }

    // Edges follow their (drifting) endpoints; flow particles and bursts read
    // the same curves, so this has to run first.
    updateEdges();
    updateFlow(elapsed);
    updateBursts(elapsed);

    // Star placement unprojects through the camera, so its matrices must be
    // current for this frame before we render.
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    positionLinkStars();

    if (composer) composer.render();
    else renderer.render(scene, camera);

    drawLinks(elapsed);
    drawTrail();
  }

  /* ---------- render loop ---------- */
  var clock = new THREE.Clock();
  var running = true;
  var lastElapsed = 0;

  // Auto-quality: if the machine can't hold ~30fps with bloom on, drop the
  // composer and render plain. Checked over 3s windows so one hitch (tab
  // switch, GC pause) doesn't trigger it.
  var fpsFrames = 0, fpsWindowStart = 0, slowWindows = 0;

  function tick() {
    if (!running) return;
    var elapsed = clock.getElapsedTime();
    var dt = Math.min(Math.max(elapsed - lastElapsed, 0.001), 0.1);
    lastElapsed = elapsed;

    if (composer) {
      fpsFrames++;
      if (elapsed - fpsWindowStart >= 3) {
        var fps = fpsFrames / (elapsed - fpsWindowStart);
        slowWindows = fps < 30 ? slowWindows + 1 : 0;
        if (slowWindows >= 2) {
          composer = null;
          bloomPass = null;
          setSize(); // re-raise the pixel-ratio cap for the plain path
        }
        fpsFrames = 0;
        fpsWindowStart = elapsed;
      }
    }

    // Smoothed scroll velocity in px/s.
    var y = window.scrollY;
    scrollVel += ((y - lastScrollY) / dt - scrollVel) * 0.12;
    lastScrollY = y;

    var target = getScrollT();
    smoothT += (target - smoothT) * 0.07;
    render(smoothT, elapsed, dt);
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', function () {
    isSmall = window.innerWidth < 760;
    setSize();
    sizeLinkCanvas();
    computeBreakpoints();
  });

  document.addEventListener('visibilitychange', function () {
    running = document.visibilityState === 'visible';
    if (running && !prefersReducedMotion) requestAnimationFrame(tick);
  });

  canvas.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    running = false;
    bail();
  });

  if (prefersReducedMotion) {
    render(getScrollT(), 0, 0.016);
  } else {
    requestAnimationFrame(tick);
  }
}());
