// ============================================================
//  Face Mesh — Easy Starter
//  Concept: ml5.js faceMesh()
//  Difficulty: 🟢 Easy
//  Estimated build time: ~30 minutes
//
//  What it teaches:
//    - How to set up ml5 faceMesh
//    - How to read keypoint data from a detected face
//    - How to map face values (mouth open, blinks) to visuals
//
//  Controls:
//    - Move your face around — dots follow your landmarks
//    - Open your mouth — dots grow and change color
//    - Blink — a ripple burst fires from the eye
//    - Press F — toggle the debug panel on/off
// ============================================================

// ── ml5 + video ─────────────────────────────────────────────
let faceMesh;   // the ml5 faceMesh model
let video;      // webcam feed
let faces = []; // detected faces (we only use the first one)

// ── Face values (0–1 range) ──────────────────────────────────
let mouthOpen  = 0; // how wide the mouth is open
let leftEye    = 1; // 1 = open, 0 = closed
let rightEye   = 1;

// ── Blink effect ─────────────────────────────────────────────
let ripples = []; // list of active ripple effects

// ── Blink tracking (we fire the ripple on the closing edge) ──
let leftWasClosed  = false;
let rightWasClosed = false;

// ── Debug panel ──────────────────────────────────────────────
let showDebug = false;

// ── Detection throttle (avoid running at full 30+ FPS) ───────
let detecting = false;
const DETECT_INTERVAL = 80; // ms between detections (~12 FPS)
let lastDetectTime = 0;

// ============================================================
//  PRELOAD — load the model before setup() runs
// ============================================================
function preload() {
  faceMesh = ml5.faceMesh({ maxFaces: 1, flipped: true });
}

// ============================================================
//  SETUP
// ============================================================
function setup() {
  createCanvas(windowWidth, windowHeight);

  // Start webcam — flipped:true mirrors it like a selfie camera
  video = createCapture(VIDEO, { flipped: true });
  video.size(160, 120); // small resolution = faster detection
  video.hide();         // we don't want to show the raw video element
}

// ============================================================
//  DRAW — runs every frame
// ============================================================
function draw() {
  background(15, 10, 30); // dark navy background

  // ── Throttled detection ────────────────────────────────────
  // We don't run the model every single frame — it's expensive.
  // Instead we call it manually on a timer.
  let now = millis();
  if (!detecting && now - lastDetectTime > DETECT_INTERVAL) {
    detecting = true;
    lastDetectTime = now;
    faceMesh.detect(video, onFaceResults);
  }

  // ── Draw the face dots ────────────────────────────────────
  drawFaceDots();

  // ── Draw ripple effects ───────────────────────────────────
  drawRipples();

  // ── Draw UI ───────────────────────────────────────────────
  drawUI();
}

// ============================================================
//  onFaceResults — called by ml5 when detection is done
// ============================================================
function onFaceResults(results) {
  detecting = false; // allow the next detection to fire
  faces = results;

  if (!faces || faces.length === 0) return; // no face found, stop here

  let kp = faces[0].keypoints; // array of {x, y, z} landmark points
  if (!kp || kp.length < 400) return; // safety check — need enough points

  // ── Face height (used to normalise ratios) ────────────────
  // kp[10]  = top of forehead
  // kp[152] = bottom of chin
  let faceH = abs(kp[152].y - kp[10].y) || 1;

  // ── Mouth openness ────────────────────────────────────────
  // kp[13] = upper inner lip, kp[14] = lower inner lip
  // We divide by faceH so the ratio is consistent at any distance
  mouthOpen = constrain((abs(kp[13].y - kp[14].y) / faceH) * 9, 0, 1);

  // ── Eye openness ─────────────────────────────────────────
  // kp[159]/kp[145] = upper/lower eyelid of right eye (your left)
  // kp[386]/kp[374] = upper/lower eyelid of left eye (your right)
  let newLeft  = constrain(abs(kp[386].y - kp[374].y) / faceH * 10, 0, 1);
  let newRight = constrain(abs(kp[159].y - kp[145].y) / faceH * 10, 0, 1);

  // ── Blink detection ──────────────────────────────────────
  // A "blink" fires on the frame the eye first closes
  const BLINK = 0.25; // eye ratio below this = closed

  if (newLeft < BLINK && !leftWasClosed) {
    // Left eye just closed — find where it is on screen and pop a ripple
    let eyeX = map(kp[386].x, 0, video.width,  width, 0);
    let eyeY = map(kp[386].y, 0, video.height, 0, height);
    ripples.push({ x: eyeX, y: eyeY, r: 0, alpha: 255 });
  }
  if (newRight < BLINK && !rightWasClosed) {
    let eyeX = map(kp[159].x, 0, video.width,  width, 0);
    let eyeY = map(kp[159].y, 0, video.height, 0, height);
    ripples.push({ x: eyeX, y: eyeY, r: 0, alpha: 255 });
  }

  leftWasClosed  = newLeft  < BLINK;
  rightWasClosed = newRight < BLINK;

  leftEye  = newLeft;
  rightEye = newRight;
}

// ============================================================
//  drawFaceDots — plots every face keypoint as a dot
// ============================================================
function drawFaceDots() {
  if (!faces || faces.length === 0) return;

  let kp = faces[0].keypoints;
  if (!kp) return;

  // The keypoints come in video-space coordinates (0..video.width)
  // We need to remap them to canvas space (0..width / 0..height)
  // The video is also mirrored, so x is flipped.

  // ── Color shifts with mouth ───────────────────────────────
  // Closed mouth → cool blue/purple
  // Open mouth   → warm pink/coral
  let dotR = lerp(120, 255, mouthOpen);
  let dotG = lerp(100, 100, mouthOpen);
  let dotB = lerp(255, 140, mouthOpen);

  // ── Dot size grows slightly with mouth open ───────────────
  let dotSize = lerp(2.5, 5.5, mouthOpen);

  noStroke();

  for (let i = 0; i < kp.length; i++) {
    // Remap from video coords to screen coords
    let sx = map(kp[i].x, 0, video.width,  width, 0); // flip X (mirrored)
    let sy = map(kp[i].y, 0, video.height, 0, height);

    fill(dotR, dotG, dotB, 200);
    ellipse(sx, sy, dotSize);
  }

  // ── Highlight a few key landmarks in a brighter color ────
  // These are the most expressive points — useful to call out
  let highlights = [
    { idx: 13,  label: "upper lip", r: 255, g: 80,  b: 120 }, // upper inner lip
    { idx: 14,  label: "lower lip", r: 255, g: 80,  b: 120 }, // lower inner lip
    { idx: 159, label: "right eye top", r: 255, g: 220, b: 60  }, // right upper eyelid
    { idx: 386, label: "left eye top",  r: 255, g: 220, b: 60  }, // left  upper eyelid
    { idx: 1,   label: "nose tip",  r: 150, g: 200, b: 255 }, // nose tip
  ];

  for (let h of highlights) {
    if (h.idx >= kp.length) continue;
    let sx = map(kp[h.idx].x, 0, video.width,  width, 0);
    let sy = map(kp[h.idx].y, 0, video.height, 0, height);
    fill(h.r, h.g, h.b, 240);
    ellipse(sx, sy, 8);
  }
}

// ============================================================
//  drawRipples — expands + fades ripple circles on blink
// ============================================================
function drawRipples() {
  noFill();
  strokeWeight(1.5);

  for (let i = ripples.length - 1; i >= 0; i--) {
    let rp = ripples[i];
    stroke(255, 220, 80, rp.alpha); // warm yellow ripple
    ellipse(rp.x, rp.y, rp.r * 2);

    rp.r     += 4;    // grow outward
    rp.alpha -= 8;    // fade out

    // Remove once fully invisible
    if (rp.alpha <= 0) ripples.splice(i, 1);
  }

  noStroke();
}

// ============================================================
//  drawUI — on-screen hints + optional debug panel
// ============================================================
function drawUI() {
  // Hint text in corner
  fill(255, 255, 255, 60);
  noStroke();
  textSize(11);
  textAlign(RIGHT, BOTTOM);
  text("F — debug panel", width - 16, height - 16);

  // "No face" message in the center
  if (!faces || faces.length === 0) {
    fill(255, 255, 255, 120);
    textSize(16);
    textAlign(CENTER, CENTER);
    text("No face detected\nLook at the camera", width / 2, height / 2);
  }

  if (showDebug) drawDebugPanel();
}

// ============================================================
//  drawDebugPanel — simple bar chart of face values
// ============================================================
function drawDebugPanel() {
  const PW = 220;
  const PH = 160;
  const PX = 20;
  const PY = 20;

  // Panel background
  fill(10, 10, 28, 210);
  stroke(255, 255, 255, 25);
  strokeWeight(1);
  rect(PX, PY, PW, PH, 6);
  noStroke();

  // Title
  fill(255, 255, 255, 160);
  textSize(9);
  textAlign(LEFT, TOP);
  text("FACE DEBUG — press F to close", PX + 12, PY + 12);

  // Status dot
  let detected = faces && faces.length > 0;
  fill(detected ? color(80, 255, 140) : color(255, 80, 80));
  ellipse(PX + PW - 14, PY + 16, 7);

  // Bars
  let metrics = [
    { label: "MOUTH OPEN", value: mouthOpen, r: 255, g: 80,  b: 120 },
    { label: "LEFT EYE",   value: leftEye,   r: 255, g: 220, b: 60  },
    { label: "RIGHT EYE",  value: rightEye,  r: 255, g: 220, b: 60  },
  ];

  let barX = PX + 12;
  let barW = PW - 24;
  let barH = 12;

  metrics.forEach((m, i) => {
    let y = PY + 36 + i * 34;

    // Label
    fill(255, 255, 255, 120);
    textSize(8);
    textAlign(LEFT, TOP);
    text(m.label, barX, y);

    // Track
    fill(255, 255, 255, 15);
    rect(barX, y + 10, barW, barH, 2);

    // Fill
    fill(m.r, m.g, m.b, 200);
    rect(barX, y + 10, barW * constrain(m.value, 0, 1), barH, 2);
  });
}

// ============================================================
//  keyPressed — F toggles debug panel
// ============================================================
function keyPressed() {
  if (key === 'f' || key === 'F') showDebug = !showDebug;
}

// ============================================================
//  windowResized — keep canvas full-screen
// ============================================================
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}