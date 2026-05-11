# Pose Estimation — Advanced: Bunny Puppet Theater

Uses ml5 `bodyPose` (MoveNet) to overlay cartoon bunny puppet pieces directly onto the live camera feed. Ears anchor to your head, a twitching nose and whiskers sit on your face, and big fluffy paws sit on your wrists — with claws that slide out when you raise your hands.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | Layout, p5/ml5 boot, draw loop, HUD wiring |
| `bunny.js` | Stage class, all bunny part drawing functions, claw logic |

---

## Dependencies

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.3/p5.min.js"></script>
<script src="https://unpkg.com/ml5@1/dist/ml5.min.js"></script>
<script src="./bunny.js"></script>
```

---

## How to run

1. Serve over HTTP. Open `index.html`. Allow camera access.
2. Wait for "Model ready" in the status chip.
3. Stand back so head and shoulders are clearly in frame.
4. Raise your wrists above your shoulders to extend the claws.

---

## Architecture overview

`bunny.js` exposes a single global object:

```js
window.BunnyTheater = { Stage, drawBunny, averageClawAmount, kp };
```

`index.html` calls these from its inline p5 script. All drawing happens in the p5 `draw()` loop in this order:

1. `image(video, …)` — live camera as backdrop
2. `stage.drawVignette(p)` — edge darkening
3. `BunnyTheater.drawBunny(p, pose, millis())` — bunny overlay
4. `stage.drawForeground(p)` — curtains, valance, footlights, dust

---

## Key variables (index.html)

| Variable | Purpose |
|---|---|
| `bodyPose` | ml5 bodyPose model |
| `video` | Webcam capture |
| `poses` | Latest detection results array |
| `stage` | `Stage` instance (theatrical decor) |
| `showDebug` | If `true`, raw keypoints are drawn as dots |

---

## Step-by-step implementation

### 1. Load the model in `preload()`

```js
function preload() {
  bodyPose = ml5.bodyPose("MoveNet", { flipped: true }, () => {
    modelReady = true;
    setStatus("Model ready - step into frame");
  });
}
```

### 2. Start detection in `setup()`

```js
bodyPose.detectStart(video, (results) => {
  poses = results || [];
});
```

### 3. The `kp` helper (bunny.js)

Before using any keypoint, its confidence must be checked. The `kp` helper centralises this check:

```js
function kp(pose, name, minConf = 0.25) {
  if (!pose) return null;
  const p = pose[name];
  if (!p || p.x === undefined) return null;
  if (p.confidence !== undefined && p.confidence < minConf) return null;
  return p;
}
```

Usage: `const nose = kp(pose, "nose")` — returns `null` if unavailable.

### 4. Head size estimation (`estimateHeadWidth`)

Ears and the nose piece need to know how big the head is on screen. The function uses the best available landmark pair, falling back gracefully:

```js
function estimateHeadWidth(pose) {
  const lEar = kp(pose, "left_ear",  0.15);
  const rEar = kp(pose, "right_ear", 0.15);
  if (lEar && rEar) return distance(lEar, rEar) * 1.25;

  const lEye = kp(pose, "left_eye",  0.15);
  const rEye = kp(pose, "right_eye", 0.15);
  if (lEye && rEye) return distance(lEye, rEye) * 2.4;

  const lSh = kp(pose, "left_shoulder");
  const rSh = kp(pose, "right_shoulder");
  if (lSh && rSh) return distance(lSh, rSh) * 0.55;

  return 100; // last resort fallback
}
```

### 5. Drawing the bunny ears (`drawBunnyEars`)

Ears are anchored to the nose keypoint. The "top of head" is estimated as `nose.y - headW * 0.55`. Each ear is drawn with `p.push()` / `p.translate()` / `p.rotate()` / `p.pop()` so they can be tilted independently:

```js
function drawSingleEar(p, baseX, baseY, length, baseW, tilt) {
  p.push();
  p.translate(baseX, baseY);
  p.rotate(tilt);

  // Outer ear shape using bezier curves
  p.noStroke();
  p.fill(...COLORS.fur);
  p.beginShape();
  p.vertex(-baseW * 0.5, 0);
  p.bezierVertex(-baseW * 0.95, -length * 0.45,
                 -baseW * 0.45, -length * 0.95,
                  0,            -length);
  p.bezierVertex( baseW * 0.45, -length * 0.95,
                  baseW * 0.95, -length * 0.45,
                  baseW * 0.5,  0);
  p.endShape(p.CLOSE);

  // Pink inner ear inset
  p.fill(...COLORS.innerEar);
  // ... similar bezier path, smaller ...

  // Cartoon outline on top
  p.stroke(...COLORS.outline);
  // ... same path again, no fill ...
  p.pop();
}
```

### 6. Drawing paws (`drawBunnyPaws`) — anti-flip fix

Paw orientation is derived from the elbow→wrist angle. When the arm points leftward, `cos(ang) < 0` and a naive `p.rotate(ang)` flips the paw upside-down. The fix:

```js
function drawPaw(p, x, y, ang, size, claw) {
  p.push();
  p.translate(x, y);

  // If cos(ang) < 0, add π to keep the paw right-side up, then mirror X
  // so the toes still point in the original direction.
  const drawAng = Math.cos(ang) < 0 ? ang + Math.PI : ang;
  const xFlip   = Math.cos(ang) < 0 ? -1 : 1;
  p.rotate(drawAng);
  p.scale(xFlip, 1);

  // All paw geometry is drawn in local space.
  // p5's transform (rotate + scale) places it on screen correctly.
  // ...
}
```

With `scale(-1, 1)` active, all `p.vertex(x, y)` calls are rendered at `(-x, y)` in screen space — so the entire paw including claws is mirrored automatically without any coordinate recalculation.

### 7. Claw extension (`clawAmount`)

```js
function clawAmount(wristY, shoulderY, span) {
  // claw=0 when wrist is at or below shoulder; claw=1 when span above it
  const t = (shoulderY - wristY) / (span * 0.7);
  return Math.max(0, Math.min(1, t));
}
```

`span` is the shoulder-to-shoulder distance, used as a body-relative scale so the threshold adapts to the user's distance from the camera.

### 8. The Stage class (theatrical decor)

`Stage` draws three layers:

- **`drawVignette(p)`** — concentric circles with increasing opacity toward the edges, darkening the corners without touching the centre stage.
- **`drawForeground(p)`** — velvet curtains (drawn as pleat-by-pleat gradient rectangles with a scalloped inner edge), golden valance across the top, row of footlight bulbs at the bottom, and animated dust motes (slow upward drift with sinusoidal wobble).
- Motes are objects `{x, y, r, vy, drift, driftSpeed, alpha}` stored in an array and updated each frame. When a mote reaches `y < -10` it is respawned below the canvas.

### 9. Nose twitch animation

The nose uses `millis()` (passed in as `time`) to animate a slow sine-wave scale + an occasional large sniff:

```js
const twitch = 1
  + Math.sin(time * 0.005) * 0.05
  + (Math.sin(time * 0.0008) > 0.95 ? 0.15 : 0);
```

The first term gives a continuous gentle pulse; the second fires a bigger sniff about once every ~8 seconds.

---

## Core ml5 API used

| Call | What it does |
|---|---|
| `ml5.bodyPose("MoveNet", { flipped }, callback)` | Loads the model; callback fires when ready |
| `bodyPose.detectStart(video, callback)` | Continuous detection |
| `results[0].nose` | `{x, y, confidence}` — and similarly for all 17 MoveNet keypoints |

---

## Common pitfalls

- **Paw flipping upside-down** — caused by `cos(ang) < 0`. The `drawAng + π` + `scale(-1, 1)` pattern in `drawPaw` fixes this. Do not remove it.
- **Ears jump when ear keypoints drop out** — `estimateHeadWidth` falls back through eye distance → shoulder distance to keep sizing stable when ears leave the frame.
- **Head size estimates change with distance** — all measurements are relative to `headW` (itself derived from keypoint spans), so the puppet scales with the user's distance from the camera automatically.
