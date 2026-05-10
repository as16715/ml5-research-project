// bunny.js - Cartoon bunny puppet pieces drawn over the live video feed.
// Rendered with p5.js. Pose data is supplied as ml5 bodyPose results (MoveNet).

// =====================================================================
// Color palette - soft snow-bunny with pink accents
// =====================================================================
const COLORS = {
  fur:        [252, 246, 236],   // warm cream-white
  furShadow:  [225, 215, 205],   // shading on rim
  innerEar:   [255, 178, 198],   // inner ear pink
  noseDeep:   [232, 95, 135],    // pink nose
  nosePale:   [255, 210, 222],   // nose highlight
  pawPad:     [255, 165, 190],   // paw pads
  cheek:      [255, 150, 180],   // blush
  outline:    [42, 26, 38],      // dark cartoon outline
  whisker:    [250, 245, 240],   // off-white whiskers
  claw:       [50, 30, 50]       // claw
};

const OUTLINE_W = 2.6;

// =====================================================================
// Helpers
// =====================================================================
function kp(pose, name, minConf = 0.25) {
  if (!pose) return null;
  const p = pose[name];
  if (!p || p.x === undefined) return null;
  if (p.confidence !== undefined && p.confidence < minConf) return null;
  return p;
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleBetween(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

// Estimate a stable head width from the most reliable available keypoints.
function estimateHeadWidth(pose) {
  const lEar = kp(pose, "left_ear", 0.15);
  const rEar = kp(pose, "right_ear", 0.15);
  if (lEar && rEar) return distance(lEar, rEar) * 1.25;

  const lEye = kp(pose, "left_eye", 0.15);
  const rEye = kp(pose, "right_eye", 0.15);
  if (lEye && rEye) return distance(lEye, rEye) * 2.4;

  const lSh = kp(pose, "left_shoulder");
  const rSh = kp(pose, "right_shoulder");
  if (lSh && rSh) return distance(lSh, rSh) * 0.55;

  return 100;
}

// =====================================================================
// Stage decor - curtains, valance, footlights, vignette
// =====================================================================
class Stage {
  constructor(width, height) {
    this.w = width;
    this.h = height;
    this.dust = [];
    for (let i = 0; i < 40; i++) this.dust.push(this.spawnMote(true));
  }

  spawnMote(initial = false) {
    return {
      x: Math.random() * this.w,
      y: initial ? Math.random() * this.h : this.h + 20,
      r: 0.8 + Math.random() * 1.6,
      vy: 0.2 + Math.random() * 0.5,
      drift: Math.random() * Math.PI * 2,
      driftSpeed: 0.005 + Math.random() * 0.01,
      alpha: 70 + Math.random() * 110
    };
  }

  // Soft vignette around the stage so the live video reads as "lit center".
  drawVignette(p) {
    p.push();
    p.noStroke();
    const cx = this.w / 2, cy = this.h * 0.55;
    const maxR = Math.hypot(this.w, this.h);
    for (let i = 14; i >= 0; i--) {
      const t = i / 14;
      p.fill(8, 4, 14, t * 22);
      p.circle(cx, cy, maxR * (0.6 + t * 0.9));
    }
    p.pop();
  }

  drawForeground(p) {
    this.updateAndDrawDust(p);
    this.drawCurtains(p);
    this.drawValance(p);
    this.drawFootlights(p);
  }

  updateAndDrawDust(p) {
    p.noStroke();
    for (const m of this.dust) {
      m.y -= m.vy;
      m.drift += m.driftSpeed;
      const x = m.x + Math.sin(m.drift) * 12;
      p.fill(255, 230, 180, m.alpha);
      p.circle(x, m.y, m.r * 2);
      if (m.y < -10) Object.assign(m, this.spawnMote(false));
    }
  }

  drawCurtains(p) {
    const sideW = this.w * 0.12;
    this._drawCurtainPanel(p, 0, sideW, false);
    this._drawCurtainPanel(p, this.w - sideW, sideW, true);
  }

  _drawCurtainPanel(p, x, w, mirrored) {
    const pleats = 6;
    for (let i = 0; i < pleats; i++) {
      const px = x + (i / pleats) * w;
      const pw = w / pleats + 1;
      const t = Math.abs((i + 0.5) / pleats - 0.5) * 2;
      const baseR = p.lerp(160, 80, t);
      const baseG = p.lerp(22,  10, t);
      const baseB = p.lerp(36,  18, t);
      for (let yy = 0; yy < this.h; yy += 2) {
        const tY = yy / this.h;
        p.stroke(baseR * (1 - tY * 0.18), baseG * (1 - tY * 0.18), baseB * (1 - tY * 0.18));
        p.line(px, yy, px + pw, yy);
      }
    }
    p.noStroke();

    // Soft scalloped inner edge for a draped silhouette.
    const innerX = mirrored ? x : x + w;
    const dir = mirrored ? -1 : 1;
    p.fill(34, 6, 14, 230);
    p.beginShape();
    p.vertex(innerX, 0);
    const scallops = 12;
    for (let i = 0; i <= scallops; i++) {
      const t = i / scallops;
      const yy = t * this.h;
      const bulge = Math.sin(t * Math.PI * scallops) * 4 * dir;
      p.vertex(innerX + bulge, yy);
    }
    p.vertex(innerX - dir * 8, this.h);
    p.vertex(innerX, this.h);
    p.endShape(p.CLOSE);

    // Golden tassel.
    const tasselY = this.h * 0.6;
    const tasselX = mirrored ? x + 6 : x + w - 6;
    p.fill(220, 175, 60);
    p.circle(tasselX, tasselY, 10);
    p.stroke(220, 175, 60);
    p.strokeWeight(2);
    p.line(tasselX, tasselY, tasselX, tasselY + 18);
    p.noStroke();
    p.fill(240, 200, 90);
    p.triangle(tasselX - 4, tasselY + 18, tasselX + 4, tasselY + 18, tasselX, tasselY + 28);
  }

  drawValance(p) {
    const h = 48;
    p.noStroke();
    p.fill(110, 14, 26);
    p.rect(0, 0, this.w, h);

    p.fill(140, 22, 36);
    p.beginShape();
    p.vertex(0, h);
    const scallops = 14;
    for (let i = 0; i <= scallops; i++) {
      const x = (i / scallops) * this.w;
      const y = h + (i % 2 === 0 ? 12 : 22);
      p.vertex(x, y);
    }
    p.vertex(this.w, h);
    p.endShape(p.CLOSE);

    p.stroke(220, 175, 60);
    p.strokeWeight(2);
    p.line(0, h, this.w, h);
    p.noStroke();
  }

  drawFootlights(p) {
    const bulbs = 11;
    for (let i = 0; i < bulbs; i++) {
      const x = (i + 0.5) * (this.w / bulbs);
      const y = this.h - 8;
      for (let g = 0; g < 5; g++) {
        p.fill(255, 200, 110, 30 - g * 5);
        p.circle(x, y, 26 - g * 4);
      }
      p.fill(255, 240, 200);
      p.circle(x, y, 7);
    }
  }
}

// =====================================================================
// Bunny pieces
// =====================================================================

// Drawn on top of the head, anchored relative to the nose keypoint.
function drawBunnyEars(p, pose, time) {
  const nose = kp(pose, "nose");
  if (!nose) return;
  const headW = estimateHeadWidth(pose);

  // The "top of head" is a bit above the nose, scaled by head size.
  const headTopY = nose.y - headW * 0.55;

  const earLen   = headW * 1.7;
  const earBaseW = headW * 0.34;

  // Tiny independent sway per ear so they feel alive.
  const swayL = Math.sin(time * 0.0028) * 0.05;
  const swayR = Math.cos(time * 0.0024) * 0.05;

  drawSingleEar(p, nose.x - headW * 0.22, headTopY, earLen, earBaseW, -0.18 + swayL);
  drawSingleEar(p, nose.x + headW * 0.22, headTopY, earLen, earBaseW,  0.18 + swayR);
}

function drawSingleEar(p, baseX, baseY, length, baseW, tilt) {
  p.push();
  p.translate(baseX, baseY);
  p.rotate(tilt);

  // Ear silhouette path - reused for fill and stroke.
  const earPath = (g) => {
    g.beginShape();
    g.vertex(-baseW * 0.5, 0);
    g.bezierVertex(-baseW * 0.95, -length * 0.45,
                   -baseW * 0.45, -length * 0.95,
                    0,            -length);
    g.bezierVertex( baseW * 0.45, -length * 0.95,
                    baseW * 0.95, -length * 0.45,
                    baseW * 0.5,  0);
    g.endShape(p.CLOSE);
  };

  // Outer fur fill.
  p.noStroke();
  p.fill(...COLORS.fur);
  earPath(p);

  // Soft rim shadow on the lower-outer side.
  p.noFill();
  p.stroke(...COLORS.furShadow);
  p.strokeWeight(OUTLINE_W * 1.2);
  p.beginShape();
  p.vertex(baseW * 0.5, -1);
  p.bezierVertex(baseW * 0.95, -length * 0.45,
                 baseW * 0.45, -length * 0.95,
                 0, -length + 1);
  p.endShape();

  // Inner pink ear.
  p.noStroke();
  p.fill(...COLORS.innerEar);
  const innerW = baseW * 0.52;
  const innerStart = -length * 0.06;
  const innerEnd   = -length * 0.86;
  p.beginShape();
  p.vertex(-innerW * 0.5, innerStart);
  p.bezierVertex(-innerW * 0.95, innerEnd * 0.45,
                 -innerW * 0.45, innerEnd * 0.95,
                  0,             innerEnd);
  p.bezierVertex( innerW * 0.45, innerEnd * 0.95,
                  innerW * 0.95, innerEnd * 0.45,
                  innerW * 0.5,  innerStart);
  p.endShape(p.CLOSE);

  // Cartoon outline on top.
  p.noFill();
  p.stroke(...COLORS.outline);
  p.strokeWeight(OUTLINE_W);
  earPath(p);

  p.pop();
}

// Pink heart nose, whiskers, blush cheeks, gentle smile.
function drawBunnyFace(p, pose, time) {
  const nose = kp(pose, "nose");
  if (!nose) return;
  const headW = estimateHeadWidth(pose);

  const noseSize = headW * 0.13;
  const twitch = 1 + Math.sin(time * 0.005) * 0.05 + (Math.sin(time * 0.0008) > 0.95 ? 0.15 : 0);

  // Cheek blush (soft pink ovals to the sides of the nose).
  p.push();
  p.noStroke();
  const cheekR = headW * 0.16;
  p.fill(COLORS.cheek[0], COLORS.cheek[1], COLORS.cheek[2], 95);
  p.ellipse(nose.x - headW * 0.34, nose.y + noseSize * 0.6, cheekR * 1.5, cheekR * 0.95);
  p.ellipse(nose.x + headW * 0.34, nose.y + noseSize * 0.6, cheekR * 1.5, cheekR * 0.95);
  p.pop();

  // Whiskers.
  p.push();
  p.stroke(COLORS.whisker[0], COLORS.whisker[1], COLORS.whisker[2], 230);
  p.strokeWeight(1.6);
  const whiskerLen = headW * 0.55;
  for (let i = 0; i < 3; i++) {
    const yOff = (i - 1) * noseSize * 0.45;
    const tilt = (i - 1) * 0.18;
    p.line(nose.x - noseSize * 0.7, nose.y + yOff,
           nose.x - noseSize * 0.7 - whiskerLen, nose.y + yOff + tilt * whiskerLen * 0.5);
    p.line(nose.x + noseSize * 0.7, nose.y + yOff,
           nose.x + noseSize * 0.7 + whiskerLen, nose.y + yOff + tilt * whiskerLen * 0.5);
  }
  p.pop();

  // Mouth: a tiny "Y" under the nose.
  p.push();
  p.stroke(...COLORS.outline);
  p.strokeWeight(2);
  p.noFill();
  const mouthY = nose.y + noseSize * 1.2;
  p.line(nose.x, nose.y + noseSize * 0.55, nose.x, mouthY);
  p.beginShape();
  p.vertex(nose.x - noseSize * 0.5, mouthY + noseSize * 0.35);
  p.quadraticVertex(nose.x, mouthY + noseSize * 0.7, nose.x + noseSize * 0.5, mouthY + noseSize * 0.35);
  p.endShape();
  p.pop();

  // Pink heart-shaped nose with twitch.
  p.push();
  p.translate(nose.x, nose.y);
  p.scale(twitch);
  p.noStroke();
  p.fill(...COLORS.noseDeep);
  p.beginShape();
  p.vertex(0, noseSize * 0.55);
  p.bezierVertex(-noseSize * 1.1, noseSize * 0.55,
                 -noseSize * 1.0, -noseSize * 0.45,
                  0,              -noseSize * 0.05);
  p.bezierVertex( noseSize * 1.0, -noseSize * 0.45,
                  noseSize * 1.1, noseSize * 0.55,
                  0,              noseSize * 0.55);
  p.endShape(p.CLOSE);

  // Outline.
  p.noFill();
  p.stroke(...COLORS.outline);
  p.strokeWeight(2);
  p.beginShape();
  p.vertex(0, noseSize * 0.55);
  p.bezierVertex(-noseSize * 1.1, noseSize * 0.55,
                 -noseSize * 1.0, -noseSize * 0.45,
                  0,              -noseSize * 0.05);
  p.bezierVertex( noseSize * 1.0, -noseSize * 0.45,
                  noseSize * 1.1, noseSize * 0.55,
                  0,              noseSize * 0.55);
  p.endShape();

  // Tiny highlight.
  p.noStroke();
  p.fill(...COLORS.nosePale);
  p.ellipse(-noseSize * 0.3, -noseSize * 0.18, noseSize * 0.4, noseSize * 0.22);
  p.pop();
}

// Compute claw extension (0 = sheathed, 1 = fully out) from wrist height.
function clawAmount(wristY, shoulderY, span) {
  if (shoulderY == null) return 0;
  // Wrist at shoulder = 0; wrist `span` above shoulder = 1.
  const t = (shoulderY - wristY) / (span * 0.7);
  return Math.max(0, Math.min(1, t));
}

function drawBunnyPaws(p, pose) {
  const lWr = kp(pose, "left_wrist");
  const rWr = kp(pose, "right_wrist");
  const lEl = kp(pose, "left_elbow");
  const rEl = kp(pose, "right_elbow");
  const lSh = kp(pose, "left_shoulder");
  const rSh = kp(pose, "right_shoulder");

  const shoulderY = (lSh && rSh) ? (lSh.y + rSh.y) / 2 : null;
  const span      = (lSh && rSh) ? distance(lSh, rSh) : 160;
  const pawSize   = span * 0.36;

  if (lWr) {
    const a = lEl ? angleBetween(lEl, lWr) : Math.PI / 2;
    drawPaw(p, lWr.x, lWr.y, a, pawSize, clawAmount(lWr.y, shoulderY, span));
  }
  if (rWr) {
    const a = rEl ? angleBetween(rEl, rWr) : Math.PI / 2;
    drawPaw(p, rWr.x, rWr.y, a, pawSize, clawAmount(rWr.y, shoulderY, span));
  }
}

function drawPaw(p, x, y, ang, size, claw) {
  p.push();
  p.translate(x, y);

  // When the arm points leftward (cos < 0) the paw would render upside-down.
  // Fix: rotate by ang+π so it's always right-side up, then mirror X so the
  // toes still extend in the original arm direction.
  const drawAng = Math.cos(ang) < 0 ? ang + Math.PI : ang;
  const xFlip   = Math.cos(ang) < 0 ? -1 : 1;
  p.rotate(drawAng);
  p.scale(xFlip, 1);

  // Fluffy wrist cuff (lobes of fur where the paw meets the arm).
  p.noStroke();
  p.fill(...COLORS.fur);
  for (let i = 0; i < 5; i++) {
    const a = (i / 4) * Math.PI - Math.PI / 2;
    const cx = Math.cos(a) * size * 0.05;
    const cy = Math.sin(a) * size * 0.45;
    p.circle(cx, cy, size * 0.4);
  }

  // Outline of the cuff cluster (single outer arc).
  p.noFill();
  p.stroke(...COLORS.outline);
  p.strokeWeight(OUTLINE_W);
  p.arc(0, 0, size * 0.95, size * 1.1, Math.PI / 2, -Math.PI / 2);

  // Main paw bulb extending past the wrist along +X.
  p.noStroke();
  p.fill(...COLORS.fur);
  p.ellipse(size * 0.55, 0, size * 1.15, size * 0.95);
  p.stroke(...COLORS.outline);
  p.strokeWeight(OUTLINE_W);
  p.noFill();
  p.ellipse(size * 0.55, 0, size * 1.15, size * 0.95);

  // Three toe bumps on the outer edge of the paw bulb.
  const toeR = size * 0.32;
  const toes = [
    { x: size * 1.02, y: -size * 0.32 },
    { x: size * 1.12, y:  0           },
    { x: size * 1.02, y:  size * 0.32 }
  ];
  for (const t of toes) {
    p.noStroke();
    p.fill(...COLORS.fur);
    p.circle(t.x, t.y, toeR);
    p.stroke(...COLORS.outline);
    p.strokeWeight(OUTLINE_W);
    p.noFill();
    p.circle(t.x, t.y, toeR);

    // Small pink toe pad.
    p.noStroke();
    p.fill(...COLORS.pawPad);
    p.circle(t.x - toeR * 0.18, t.y, toeR * 0.45);
  }

  // Big central palm pad (rounded triangle / heart-ish shape).
  p.noStroke();
  p.fill(...COLORS.pawPad);
  p.beginShape();
  p.vertex(size * 0.40, -size * 0.32);
  p.bezierVertex(size * 0.20, -size * 0.30,
                 size * 0.20,  size * 0.30,
                 size * 0.40,  size * 0.32);
  p.bezierVertex(size * 0.85,  size * 0.30,
                 size * 0.85, -size * 0.30,
                 size * 0.40, -size * 0.32);
  p.endShape(p.CLOSE);
  p.stroke(...COLORS.outline);
  p.strokeWeight(OUTLINE_W * 0.85);
  p.noFill();
  p.beginShape();
  p.vertex(size * 0.40, -size * 0.32);
  p.bezierVertex(size * 0.20, -size * 0.30,
                 size * 0.20,  size * 0.30,
                 size * 0.40,  size * 0.32);
  p.bezierVertex(size * 0.85,  size * 0.30,
                 size * 0.85, -size * 0.30,
                 size * 0.40, -size * 0.32);
  p.endShape();

  // Claws extending from each toe based on `claw` factor.
  if (claw > 0.02) {
    p.noStroke();
    p.fill(...COLORS.claw);
    for (const t of toes) {
      const baseX = t.x + toeR * 0.35;
      const baseY = t.y;
      const len   = toeR * 1.05 * claw;
      const halfW = toeR * 0.22;
      const dir = Math.atan2(baseY, baseX - size * 0.55); // outward from paw center
      const tipX = baseX + Math.cos(dir) * len;
      const tipY = baseY + Math.sin(dir) * len;
      p.beginShape();
      p.vertex(baseX + Math.cos(dir + Math.PI / 2) * halfW,
               baseY + Math.sin(dir + Math.PI / 2) * halfW);
      p.vertex(tipX, tipY);
      p.vertex(baseX + Math.cos(dir - Math.PI / 2) * halfW,
               baseY + Math.sin(dir - Math.PI / 2) * halfW);
      p.endShape(p.CLOSE);
    }
  }

  p.pop();
}

// Composite renderer used by index.html.
function drawBunny(p, pose, time) {
  if (!pose) return;
  drawBunnyEars(p, pose, time);
  drawBunnyFace(p, pose, time);
  drawBunnyPaws(p, pose);
}

// Compute the average claw extension across both hands - useful for HUD.
function averageClawAmount(pose) {
  if (!pose) return 0;
  const lSh = kp(pose, "left_shoulder");
  const rSh = kp(pose, "right_shoulder");
  if (!lSh || !rSh) return 0;
  const shoulderY = (lSh.y + rSh.y) / 2;
  const span = distance(lSh, rSh);
  const lWr = kp(pose, "left_wrist");
  const rWr = kp(pose, "right_wrist");
  let sum = 0, n = 0;
  if (lWr) { sum += clawAmount(lWr.y, shoulderY, span); n++; }
  if (rWr) { sum += clawAmount(rWr.y, shoulderY, span); n++; }
  return n ? sum / n : 0;
}

// Expose for the inline script.
window.BunnyTheater = {
  Stage,
  drawBunny,
  averageClawAmount,
  kp
};
