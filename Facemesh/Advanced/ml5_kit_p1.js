let stars = [];
let numStars;
let maxDistance = 150;
let mouseInfluenceDistance = 200;

let prevMouseX, prevMouseY;
let mouseSpeed = 0;
let targetSpeedMultiplier = 1;
let currentSpeedMultiplier = 1;

// ── ml5 face state ──────────────────────────────────────
let faceMesh;
let video;
let faces = [];

let face_mouthOpen = 0;
let face_browRaise = 0;
let face_headTilt  = 0;
let face_leftEye   = 1;
let face_rightEye  = 1;

let leftBlinkWas = false;
let rightBlinkWas = false;
let blinkBurst = false;
let warpActive = false;
let warpFrame  = 0;

const BLINK_THRESHOLD = 0.25;
const WARP_THRESHOLD  = 0.85;

// ── Face panel toggle ────────────────────────────────────
let showFacePanel = false;

// ── Color themes ─────────────────────────────────────────
let currentTheme = 0;
let themes = [
  { name: "Classic Night", bg1: [2,2,48],    bg2: [80,40,130],  starColor: [255,255,255], lineColor: [255,255,255], mouseLineColor: [233,217,255] },
  { name: "Ocean Deep",    bg1: [0,20,40],   bg2: [0,80,120],   starColor: [100,200,255], lineColor: [100,200,255], mouseLineColor: [150,255,255] },
  { name: "Sunset Glow",   bg1: [40,20,60],  bg2: [180,80,100], starColor: [255,200,100], lineColor: [255,180,120], mouseLineColor: [255,150,150] },
  { name: "Forest Night",  bg1: [10,20,15],  bg2: [30,80,50],   starColor: [200,255,180], lineColor: [150,255,150], mouseLineColor: [180,255,200] },
  { name: "Purple Dream",  bg1: [20,0,40],   bg2: [100,40,140], starColor: [255,180,255], lineColor: [200,100,255], mouseLineColor: [255,150,255] }
];

let settingsButton = { x: 20, y: 20, width: 40, height: 40, hovered: false };
let themeMenu = { open: false, x: 20, y: 70, width: 180, itemHeight: 35 };

// ── Cached gradient ──────────────────────────────────────
let gradientBuffer;
let cachedTheme = -1;
let cachedW = 0;
let cachedH = 0;

// ── Spatial grid for O(n) neighbor lookups ───────────────
let grid = {};
let gridCellSize = 150;

// ── Face detection throttle ──────────────────────────────
let faceDetecting = false;           // true while an inference is in-flight
const FACE_DETECT_INTERVAL = 100;    // ms between detections (10 FPS — was 30+)
let lastFaceDetectTime = 0;

// ── Smoothed face values (lerped between detections) ─────
let raw_mouthOpen = 0, raw_browRaise = 0, raw_headTilt = 0;
let raw_leftEye = 1, raw_rightEye = 1;
const FACE_LERP = 0.25;              // smoothing factor per frame

// ── Pre-squared distances to avoid sqrt ──────────────────
let maxDistSq = maxDistance * maxDistance;
let mouseDistSq = mouseInfluenceDistance * mouseInfluenceDistance;

// ─────────────────────────────────────────────────────────

function preload() {
  faceMesh = ml5.faceMesh({ maxFaces: 1, flipped: true });
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();

  prevMouseX = mouseX;
  prevMouseY = mouseY;

  numStars = floor((width * height) / 5000); // Could lower stars too if needed
  for (let i = 0; i < numStars; i++) {
    stars.push(new Star(random(width), random(height), random(2, 5)));
  }

  video = createCapture(VIDEO, { flipped: true });
  video.size(160, 120); // Could lower this too for better compute
  video.hide();

  // DON'T use detectStart — it fires on every video frame (~30 FPS)
  // and each inference blocks the main thread / GPU.
  // Instead we call detect() manually on a throttled timer.
}

// ── Spatial grid helpers ─────────────────────────────────
function buildGrid() {
  grid = {};
  let inv = 1 / gridCellSize;
  for (let i = 0; i < stars.length; i++) {
    let s = stars[i];
    let cx = (s.x * inv) | 0;
    let cy = (s.y * inv) | 0;
    let key = cx + ',' + cy;
    if (grid[key]) grid[key].push(i);
    else grid[key] = [i];
    s._gridX = cx;
    s._gridY = cy;
  }
}

function getNeighborIndices(cx, cy) {
  let result = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      let key = (cx + dx) + ',' + (cy + dy);
      let cell = grid[key];
      if (cell) {
        for (let k = 0; k < cell.length; k++) result.push(cell[k]);
      }
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────

function draw() {
  let dx = mouseX - prevMouseX;
  let dy = mouseY - prevMouseY;
  mouseSpeed = sqrt(dx * dx + dy * dy);
  prevMouseX = mouseX;
  prevMouseY = mouseY;

  let mouseOutside = mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height;

  let faceBoost = face_mouthOpen * 4.5;
  if (mouseOutside) {
    targetSpeedMultiplier = 0.2 + faceBoost;
  } else if (mouseSpeed > 3) {
    targetSpeedMultiplier = constrain(map(mouseSpeed, 0, 40, 1, 6) + faceBoost, 0.2, 10);
  } else {
    targetSpeedMultiplier = 1 + faceBoost;
  }
  currentSpeedMultiplier = lerp(currentSpeedMultiplier, targetSpeedMultiplier, 0.15);

  let theme = themes[currentTheme];
  if (!gradientBuffer || cachedTheme !== currentTheme || cachedW !== width || cachedH !== height) {
    gradientBuffer = createGraphics(width, height);
    let ctx = gradientBuffer.drawingContext;
    let grd = ctx.createLinearGradient(0, 0, 0, height);
    grd.addColorStop(0, 'rgb(' + theme.bg1[0] + ',' + theme.bg1[1] + ',' + theme.bg1[2] + ')');
    grd.addColorStop(1, 'rgb(' + theme.bg2[0] + ',' + theme.bg2[1] + ',' + theme.bg2[2] + ')');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);
    cachedTheme = currentTheme;
    cachedW = width;
    cachedH = height;
  }
  image(gradientBuffer, 0, 0);

  // ── Throttled face detection: one inference at a time, ~10 FPS ──
  let now = millis();
  if (!faceDetecting && now - lastFaceDetectTime > FACE_DETECT_INTERVAL) {
    faceDetecting = true;
    lastFaceDetectTime = now;
    faceMesh.detect(video, onFaceResults);
  }

  // ── Smooth face values toward latest raw readings ──
  face_mouthOpen = lerp(face_mouthOpen, raw_mouthOpen, FACE_LERP);
  face_browRaise = lerp(face_browRaise, raw_browRaise, FACE_LERP);
  face_headTilt  = lerp(face_headTilt,  raw_headTilt,  FACE_LERP);
  face_leftEye   = lerp(face_leftEye,   raw_leftEye,   FACE_LERP);
  face_rightEye  = lerp(face_rightEye,  raw_rightEye,  FACE_LERP);

  if (warpActive) {
    warpFrame++;
    push();
    translate(width / 2, height / 2);
    noFill();
    for (let r = 0; r < 3; r++) {
      let sc = map(warpFrame + r * 10, 0, 40, 0.05, 2.5);
      let al = map(warpFrame, 0, 40, 80, 0) * (1 - r * 0.3);
      stroke(theme.starColor[0], theme.starColor[1], theme.starColor[2], al);
      strokeWeight(2 - r * 0.5);
      ellipse(0, 0, width * sc, height * 0.6 * sc);
    }
    pop();
    if (warpFrame > 40) { warpActive = false; warpFrame = 0; }
  }

  if (blinkBurst) {
    let cx = random(width);
    let cy = random(height);
    for (let b = 0; b < 14; b++) {
      let angle = random(TWO_PI);
      let r = random(4, 70);
      stars.push(new Star(cx + cos(angle) * r, cy + sin(angle) * r, random(2, 5.5), true));
    }
    blinkBurst = false;
  }

  if (stars.length > 650) stars.splice(0, stars.length - 650);

  let connDist = maxDistance + face_browRaise * 130;
  let connDistSq = connDist * connDist;
  gridCellSize = max(connDist, mouseInfluenceDistance);

  for (let i = 0; i < stars.length; i++) {
    stars[i].move(currentSpeedMultiplier);
  }

  buildGrid();

  noStroke();
  let sr = theme.starColor[0], sg = theme.starColor[1], sb = theme.starColor[2];
  let fc = frameCount;
  for (let i = 0; i < stars.length; i++) {
    let s = stars[i];
    if (s.burst) s.alpha = min(255, s.alpha + 18);
    else {
      // Time-based twinkle instead of random() every frame
      s.alpha = 200 + 55 * (0.5 + 0.5 * sin(fc * 0.12 + s._phase));
    }
    fill(sr, sg, sb, s.alpha);
    ellipse(s.x, s.y, s.starSize);
  }

  let lr = theme.lineColor[0], lg = theme.lineColor[1], lb = theme.lineColor[2];
  strokeWeight(1);
  for (let i = 0; i < stars.length; i++) {
    let s = stars[i];
    let neighbors = getNeighborIndices(s._gridX, s._gridY);
    for (let n = 0; n < neighbors.length; n++) {
      let j = neighbors[n];
      if (j <= i) continue; // avoid duplicates and self
      let other = stars[j];
      let ddx = s.x - other.x;
      let ddy = s.y - other.y;
      let dSq = ddx * ddx + ddy * ddy;
      if (dSq < connDistSq) {
        let d = sqrt(dSq);
        stroke(lr, lg, lb, 255 - (d / connDist) * 255);
        line(s.x, s.y, other.x, other.y);
      }
    }
  }

  if (!mouseOutside) {
    let mr = theme.mouseLineColor[0], mg = theme.mouseLineColor[1], mb = theme.mouseLineColor[2];
    let mCellX = (mouseX / gridCellSize) | 0;
    let mCellY = (mouseY / gridCellSize) | 0;
    let mouseNeighbors = getNeighborIndices(mCellX, mCellY);
    for (let n = 0; n < mouseNeighbors.length; n++) {
      let s = stars[mouseNeighbors[n]];
      let ddx = s.x - mouseX;
      let ddy = s.y - mouseY;
      let dSq = ddx * ddx + ddy * ddy;
      if (dSq < mouseDistSq) {
        let md = sqrt(dSq);
        stroke(mr, mg, mb, map(md, 0, mouseInfluenceDistance, 255, 50));
        strokeWeight(map(md, 0, mouseInfluenceDistance, 2, 0.5));
        line(s.x, s.y, mouseX, mouseY);
      }
    }
  }

  drawUI();
}

function keyPressed() {
  if (key === 'f' || key === 'F') {
    showFacePanel = !showFacePanel;
  }
}

function onFaceResults(results) {
  faceDetecting = false;

  faces = results;
  if (!faces || faces.length === 0) return;

  let kp = faces[0].keypoints;
  if (!kp || kp.length < 400) return;

  let faceH = abs(kp[152].y - kp[10].y) || 1;

  raw_mouthOpen = min(1, (abs(kp[13].y - kp[14].y) / faceH) * 9);
  raw_browRaise = min(1, (abs(kp[55].y - kp[159].y) / faceH) * 5);
  raw_headTilt  = constrain((kp[454].y - kp[234].y) / faceH * 3, -1, 1);
  raw_leftEye   = min(1, abs(kp[159].y - kp[145].y) / faceH * 10);
  raw_rightEye  = min(1, abs(kp[386].y - kp[374].y) / faceH * 10);

  let lClosed = raw_leftEye  < BLINK_THRESHOLD;
  let rClosed = raw_rightEye < BLINK_THRESHOLD;

  if (lClosed && !leftBlinkWas)  blinkBurst = true;
  if (rClosed && !rightBlinkWas) blinkBurst = true;

  leftBlinkWas  = lClosed;
  rightBlinkWas = rClosed;

  if (raw_leftEye > WARP_THRESHOLD && raw_rightEye > WARP_THRESHOLD
      && raw_mouthOpen > 0.4 && !warpActive) {
    warpActive = true;
  }
}

// ── Star class ───────────────────────────────────────────
class Star {
  constructor(x, y, starSize, burst = false) {
    this.x = x;
    this.y = y;
    this.starSize = starSize;
    this.baseSpeedX = random(-0.5, 0.5);
    this.baseSpeedY = random(-0.5, 0.5);
    this.alpha = burst ? 0 : random(200, 255);
    this.burst = burst;
    this._phase = random(TWO_PI); // unique twinkle phase
    this._gridX = 0;
    this._gridY = 0;
  }

  move(speedMultiplier) {
    let tiltBias = face_headTilt * 0.5;
    this.x += this.baseSpeedX * speedMultiplier;
    this.y += (this.baseSpeedY + tiltBias) * speedMultiplier;
    if (this.x < 0) this.x = width;
    if (this.x > width) this.x = 0;
    if (this.y < 0) this.y = height;
    if (this.y > height) this.y = 0;
  }
}

// ── UI ───────────────────────────────────────────────────
function mousePressed() {
  if (settingsButton.hovered) { themeMenu.open = !themeMenu.open; return; }
  if (themeMenu.open) {
    for (let i = 0; i < themes.length; i++) {
      let itemY = themeMenu.y + i * themeMenu.itemHeight;
      if (mouseX > themeMenu.x && mouseX < themeMenu.x + themeMenu.width &&
          mouseY > itemY && mouseY < itemY + themeMenu.itemHeight) {
        currentTheme = i; themeMenu.open = false; return;
      }
    }
    themeMenu.open = false; return;
  }
  stars.push(new Star(mouseX, mouseY, random(2, 5)));
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  stars = [];
  numStars = floor((width * height) / 5000);
  for (let i = 0; i < numStars; i++) {
    stars.push(new Star(random(width), random(height), random(2, 5)));
  }
  // Force gradient rebuild on next frame
  cachedW = 0;
}

function drawUI() {
  settingsButton.hovered =
    mouseX > settingsButton.x && mouseX < settingsButton.x + settingsButton.width &&
    mouseY > settingsButton.y && mouseY < settingsButton.y + settingsButton.height;

  push();
  fill(255, 255, 255, settingsButton.hovered ? 255 : 180);
  noStroke();
  let cx = settingsButton.x + settingsButton.width / 2;
  let cy = settingsButton.y + settingsButton.height / 2;
  ellipse(cx, cy, 30, 30);
  let theme = themes[currentTheme];
  fill(theme.bg1[0], theme.bg1[1], theme.bg1[2]);
  ellipse(cx, cy, 15, 15);
  fill(255, 255, 255, settingsButton.hovered ? 255 : 180);
  for (let i = 0; i < 6; i++) {
    let angle = i * (TWO_PI / 6);
    ellipse(cx + cos(angle) * 12, cy + sin(angle) * 12, 6, 6);
  }

  if (themeMenu.open) {
    fill(30, 30, 50, 230);
    noStroke();
    rect(themeMenu.x, themeMenu.y, themeMenu.width, themes.length * themeMenu.itemHeight, 5);
    for (let i = 0; i < themes.length; i++) {
      let itemY = themeMenu.y + i * themeMenu.itemHeight;
      let hovered = mouseX > themeMenu.x && mouseX < themeMenu.x + themeMenu.width &&
                    mouseY > itemY && mouseY < itemY + themeMenu.itemHeight;
      if (hovered || i === currentTheme) {
        fill(255, 255, 255, hovered ? 50 : 30);
        rect(themeMenu.x, itemY, themeMenu.width, themeMenu.itemHeight);
      }
      fill(themes[i].starColor[0], themes[i].starColor[1], themes[i].starColor[2]);
      ellipse(themeMenu.x + 20, itemY + themeMenu.itemHeight / 2, 12, 12);
      fill(255); noStroke(); textSize(14);
      textAlign(LEFT, CENTER);
      text(themes[i].name, themeMenu.x + 35, itemY + themeMenu.itemHeight / 2);
      if (i === currentTheme) {
        fill(100, 255, 100); textSize(16);
        textAlign(RIGHT, CENTER);
        text("✓", themeMenu.x + themeMenu.width - 15, itemY + themeMenu.itemHeight / 2);
      }
    }
  }
  pop();

  // F key hint
  push();
  fill(255, 255, 255, 60);
  noStroke();
  textSize(10);
  textAlign(RIGHT, BOTTOM);
  text("F — face panel", width - 16, height - 16);
  pop();

  if (showFacePanel) drawFacePanel();
}

function drawFacePanel() {
  const PW = 260;
  const PH = 390;
  const PX = width - PW - 16;
  const PY = 16;
  const CAM_W = PW - 24;
  const CAM_H = CAM_W * 0.75;

  push();

  // Panel background
  fill(8, 8, 24, 220);
  stroke(255, 255, 255, 30);
  strokeWeight(1);
  rect(PX, PY, PW, PH, 6);

  // Title
  noStroke();
  fill(255, 255, 255, 180);
  textSize(9);
  textAlign(LEFT, TOP);
  text("FACE DEBUG  ·  press F to close", PX + 12, PY + 12);

  // Status dot
  let detected = faces && faces.length > 0;
  noStroke();
  fill(detected ? color(80, 255, 140) : color(255, 80, 80));
  ellipse(PX + PW - 18, PY + 18, 7, 7);
  fill(255, 255, 255, 100);
  textSize(8);
  textAlign(RIGHT, CENTER);
  text(detected ? "face detected" : "no face", PX + PW - 24, PY + 18);

  // ── Webcam feed ───────────────────────────────────────────
  const camX = PX + 12;
  const camY = PY + 28;

  if (video && showFacePanel) {
    push();
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(camX, camY, CAM_W, CAM_H);
    drawingContext.clip();
    // draw mirrored video
    translate(camX + CAM_W, camY);
    scale(-1, 1);
    image(video, 0, 0, CAM_W, CAM_H);
    drawingContext.restore();
    pop();

    // ── Face mesh overlay ─────────────────────────────────
    if (faces && faces.length > 0) {
      let kp = faces[0].keypoints;
      if (kp) {
        let sx = CAM_W / video.width;
        let sy = CAM_H / video.height;

        push();
        noFill();
        strokeWeight(0.8);

        // Jaw — blue
        stroke(100, 180, 255, 180);
        beginShape();
        [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,
         400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,
         54,103,67,109,10].forEach(idx => {
          if (idx < kp.length) vertex(camX + (CAM_W - kp[idx].x * sx), camY + kp[idx].y * sy);
        });
        endShape();

        // Left eye — yellow
        stroke(255, 220, 80, 180);
        beginShape();
        [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398,362].forEach(idx => {
          if (idx < kp.length) vertex(camX + (CAM_W - kp[idx].x * sx), camY + kp[idx].y * sy);
        });
        endShape();

        // Right eye — yellow
        beginShape();
        [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246,33].forEach(idx => {
          if (idx < kp.length) vertex(camX + (CAM_W - kp[idx].x * sx), camY + kp[idx].y * sy);
        });
        endShape();

        // Lips — pink
        stroke(255, 100, 120, 180);
        beginShape();
        [61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146,61].forEach(idx => {
          if (idx < kp.length) vertex(camX + (CAM_W - kp[idx].x * sx), camY + kp[idx].y * sy);
        });
        endShape();

        // Brows — green
        stroke(180, 255, 160, 180);
        beginShape();
        [55,65,52,53,46].forEach(idx => {
          if (idx < kp.length) vertex(camX + (CAM_W - kp[idx].x * sx), camY + kp[idx].y * sy);
        });
        endShape();
        beginShape();
        [285,295,282,283,276].forEach(idx => {
          if (idx < kp.length) vertex(camX + (CAM_W - kp[idx].x * sx), camY + kp[idx].y * sy);
        });
        endShape();

        // Key dots
        const dots = [
          { idx: 13,  r: 255, g: 100, b: 120 },
          { idx: 14,  r: 255, g: 100, b: 120 },
          { idx: 159, r: 255, g: 220, b: 80  },
          { idx: 386, r: 255, g: 220, b: 80  },
          { idx: 55,  r: 180, g: 255, b: 160 },
          { idx: 285, r: 180, g: 255, b: 160 },
          { idx: 1,   r: 255, g: 200, b: 100 },
        ];
        dots.forEach(({ idx, r, g, b }) => {
          if (idx < kp.length) {
            noStroke();
            fill(r, g, b, 220);
            ellipse(camX + (CAM_W - kp[idx].x * sx), camY + kp[idx].y * sy, 4, 4);
          }
        });

        pop();
      }
    }
  }

  // Cam border
  noFill();
  stroke(255, 255, 255, 40);
  strokeWeight(1);
  rect(camX, camY, CAM_W, CAM_H);

  // ── Live metric bars ──────────────────────────────────────
  const barX      = PX + 12;
  const barStartY = camY + CAM_H + 16;
  const barW      = PW - 24;
  const barH      = 14;
  const rowGap    = 28;

  const metrics = [
    { label: "MOUTH OPEN", value: face_mouthOpen,        r: 255, g: 100, b: 120,
      active: face_mouthOpen > 0.2,              activeLabel: "→ speed boost" },
    { label: "BROW RAISE", value: face_browRaise,        r: 180, g: 255, b: 160,
      active: face_browRaise > 0.5,              activeLabel: "→ wider links" },
    { label: "HEAD TILT",  value: (face_headTilt+1)/2,   r: 100, g: 180, b: 255,
      active: abs(face_headTilt) > 0.3,          activeLabel: face_headTilt > 0 ? "→ drift right" : "→ drift left" },
    { label: "LEFT EYE",   value: face_leftEye,          r: 255, g: 220, b: 80,
      active: face_leftEye < BLINK_THRESHOLD,    activeLabel: "BLINK!" },
    { label: "RIGHT EYE",  value: face_rightEye,         r: 255, g: 220, b: 80,
      active: face_rightEye < BLINK_THRESHOLD,   activeLabel: "BLINK!" },
  ];

  metrics.forEach((m, i) => {
    let y = barStartY + i * rowGap;

    noStroke();
    fill(255, 255, 255, 120);
    textSize(8);
    textAlign(LEFT, TOP);
    text(m.label, barX, y);

    if (m.active) {
      fill(m.r, m.g, m.b, 200);
      textAlign(RIGHT, TOP);
      text(m.activeLabel, barX + barW, y);
    }

    // Track
    fill(255, 255, 255, 15);
    noStroke();
    rect(barX, y + 11, barW, barH, 2);

    // Fill
    fill(m.r, m.g, m.b, m.active ? 220 : 120);
    rect(barX, y + 11, barW * constrain(m.value, 0, 1), barH, 2);
  });

  pop();
}
