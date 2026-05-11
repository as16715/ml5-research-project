# Face Mesh — Easy: Landmark Dots

Renders all 468 face keypoints as coloured dots that react to mouth openness and blink detection, using ml5 `faceMesh` on a full-screen p5 canvas.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | Loads libraries and the main JS file |
| `Ml5_facemesh_Easy.js` | All p5 + ml5 logic |
| `style.css` | Page layout styles |

---

## Dependencies

```html
<script src="https://cdn.jsdelivr.net/npm/p5@1.11.12/lib/p5.js"></script>
<script src="https://unpkg.com/ml5@1/dist/ml5.min.js"></script>
```

---

## How to run

Open `index.html` in a browser (any local server works). Allow camera access. Press **F** to toggle the debug panel.

---

## Key variables

| Variable | Purpose |
|---|---|
| `faceMesh` | The ml5 faceMesh model |
| `video` | Webcam capture, intentionally small (160×120) to keep inference fast |
| `faces` | Array of detected faces; only `faces[0]` is used |
| `mouthOpen` | 0–1 value derived from inner lip distance |
| `leftEye`, `rightEye` | 0–1 openness ratios per eye |
| `ripples` | Array of `{x, y, r, alpha}` objects for blink ring effects |
| `detecting` | Flag that prevents launching a new inference while one is in flight |
| `DETECT_INTERVAL` | Milliseconds between detections (~12 FPS) |

---

## Step-by-step implementation

### 1. Load the model in `preload()`

```js
function preload() {
  faceMesh = ml5.faceMesh({ maxFaces: 1, flipped: true });
}
```

`flipped: true` mirrors the coordinate system to match the mirrored video feed.

### 2. Set up the video at a small resolution

A smaller capture size dramatically reduces inference time without affecting landmark quality for on-screen display.

```js
function setup() {
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO, { flipped: true });
  video.size(160, 120); // small = faster per-frame inference
  video.hide();
}
```

### 3. Throttle detection in `draw()`

Instead of calling `detectStart` (which fires on every video frame), the project calls `detect()` manually on a timer. This keeps the main thread from stalling.

```js
let now = millis();
if (!detecting && now - lastDetectTime > DETECT_INTERVAL) {
  detecting = true;
  lastDetectTime = now;
  faceMesh.detect(video, onFaceResults); // one-shot call
}
```

### 4. Parse keypoints in the result callback

The callback receives an array of face objects. Each face has a `keypoints` array of 468 `{x, y, z}` points in **video coordinate space** (0…video.width, 0…video.height).

```js
function onFaceResults(results) {
  detecting = false; // allow next detection to fire
  faces = results;
  if (!faces || faces.length === 0) return;

  let kp = faces[0].keypoints;
  if (!kp || kp.length < 400) return;

  // Normalise measurements by face height so they're distance-independent
  let faceH = abs(kp[152].y - kp[10].y) || 1; // chin to forehead

  // Mouth openness: inner lip gap / face height
  mouthOpen = constrain((abs(kp[13].y - kp[14].y) / faceH) * 9, 0, 1);

  // Eye openness: eyelid gap / face height
  leftEye  = constrain(abs(kp[386].y - kp[374].y) / faceH * 10, 0, 1);
  rightEye = constrain(abs(kp[159].y - kp[145].y) / faceH * 10, 0, 1);
}
```

**Key landmark indices used:**

| Index | Landmark |
|---|---|
| 10 | Top of forehead |
| 152 | Chin |
| 13 | Upper inner lip |
| 14 | Lower inner lip |
| 159 / 145 | Right eye upper / lower lid |
| 386 / 374 | Left eye upper / lower lid |

### 5. Map video coordinates to canvas coordinates

Because the video is small (160×120) and the canvas is full-screen, every keypoint must be remapped. The video is also horizontally mirrored, so X is flipped.

```js
let sx = map(kp[i].x, 0, video.width,  width, 0); // flip X
let sy = map(kp[i].y, 0, video.height, 0, height);
```

### 6. Drive visuals from face values

Dot colour and size interpolate between two states based on `mouthOpen`:

```js
let dotR = lerp(120, 255, mouthOpen); // blue → coral
let dotG = lerp(100, 100, mouthOpen);
let dotB = lerp(255, 140, mouthOpen);
let dotSize = lerp(2.5, 5.5, mouthOpen);
```

### 7. Detect blinks and spawn ripples

A blink is detected on the **closing edge** — the first frame the eye ratio drops below the threshold. This fires exactly once per blink.

```js
const BLINK = 0.25;
if (newLeft < BLINK && !leftWasClosed) {
  ripples.push({ x: eyeX, y: eyeY, r: 0, alpha: 255 });
}
leftWasClosed = newLeft < BLINK;
```

Each frame, every ripple grows its radius and fades its alpha until it disappears:

```js
rp.r     += 4;
rp.alpha -= 8;
if (rp.alpha <= 0) ripples.splice(i, 1);
```

### 8. Debug panel (F key)

`keyPressed()` toggles `showDebug`. When active, `drawDebugPanel()` renders a bar chart of `mouthOpen`, `leftEye`, and `rightEye` values.

---

## Core ml5 API used

| Call | What it does |
|---|---|
| `ml5.faceMesh({ maxFaces, flipped })` | Creates the model |
| `faceMesh.detect(video, callback)` | Single-shot inference; callback receives `results[]` |
| `results[0].keypoints` | Array of 468 `{x, y, z}` landmark points in video space |

---

## Common pitfalls

- **All dots at position (0, 0)** — keypoints are in video space, not canvas space. Always remap them with `map()`.
- **Runaway detections** — calling `detect()` again before the previous call resolves causes queuing. Use the `detecting` flag to prevent this.
- **Blink fires continuously** — store the previous eye state (`leftWasClosed`) and only trigger on the transition from open → closed.
