# Face Mesh — Advanced: Astral Drift

A full-screen interactive star field whose behaviour is driven by face expressions detected by ml5 `faceMesh`. Stars drift, connect with lines, and react to mouth openness, brow raises, head tilt, and blinks. A settings gear cycles through five colour themes; pressing **F** opens a face debug panel with a live webcam feed and metric bars.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | Loads libraries, nav bar, and the main JS file |
| `ml5_kit_p1.js` | All p5 + ml5 logic (Star class, face parsing, UI, draw loop) |

---

## Dependencies

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.3/p5.min.js"></script>
<script src="https://unpkg.com/ml5@1/dist/ml5.min.js"></script>
```

---

## How to run

Serve with any local server and open in a browser. Allow camera access. Move your mouse, open your mouth, raise your eyebrows, or blink. Press **F** for the debug panel.

---

## Key variables

| Variable | Purpose |
|---|---|
| `stars` | Array of `Star` instances that drift and connect |
| `faces` | Latest ml5 detection results |
| `face_mouthOpen` | Smoothed 0–1 mouth openness |
| `face_browRaise` | Smoothed 0–1 brow raise |
| `face_headTilt` | Smoothed –1…+1 head tilt (negative = left, positive = right) |
| `face_leftEye`, `face_rightEye` | Smoothed 0–1 eye openness |
| `raw_*` | The last raw reading for each face metric (used for lerp target) |
| `currentSpeedMultiplier` | Global star speed; driven by mouse speed + mouth open |
| `grid` | Spatial hash for O(n) neighbour lookups when drawing connection lines |
| `gradientBuffer` | Cached off-screen graphics for the background gradient |
| `FACE_DETECT_INTERVAL` | Milliseconds between face detections (100 ms = ~10 FPS) |
| `FACE_LERP` | Per-frame smoothing factor (0.25) applied to raw → display values |

---

## Step-by-step implementation

### 1. Load the model in `preload()`

```js
function preload() {
  faceMesh = ml5.faceMesh({ maxFaces: 1, flipped: true });
}
```

### 2. Set up video and stars in `setup()`

The video is intentionally kept at 160×120 — small enough that inference is fast but large enough for reliable keypoint detection. Stars are spawned proportionally to the canvas area.

```js
video = createCapture(VIDEO, { flipped: true });
video.size(160, 120);
video.hide();

numStars = floor((width * height) / 5000);
for (let i = 0; i < numStars; i++) {
  stars.push(new Star(random(width), random(height), random(2, 5)));
}
```

### 3. Throttle detection — do not use `detectStart`

`detectStart` fires on every video frame (~30 FPS). Each inference blocks the main thread. Instead, call `detect()` manually at ~10 FPS using a timestamp check:

```js
let now = millis();
if (!faceDetecting && now - lastFaceDetectTime > FACE_DETECT_INTERVAL) {
  faceDetecting = true;
  lastFaceDetectTime = now;
  faceMesh.detect(video, onFaceResults);
}
```

### 4. Parse face metrics in the result callback

All measurements are normalised by face height (`kp[152].y - kp[10].y`) so they remain consistent at any camera distance.

```js
function onFaceResults(results) {
  faceDetecting = false;
  faces = results;
  if (!faces || faces.length === 0) return;
  let kp = faces[0].keypoints;
  let faceH = abs(kp[152].y - kp[10].y) || 1;

  raw_mouthOpen = min(1, (abs(kp[13].y - kp[14].y) / faceH) * 9);
  raw_browRaise = min(1, (abs(kp[55].y - kp[159].y) / faceH) * 5);
  raw_headTilt  = constrain((kp[454].y - kp[234].y) / faceH * 3, -1, 1);
  raw_leftEye   = min(1, abs(kp[159].y - kp[145].y) / faceH * 10);
  raw_rightEye  = min(1, abs(kp[386].y - kp[374].y) / faceH * 10);
}
```

**Landmark indices for each metric:**

| Metric | Keypoints used |
|---|---|
| Mouth open | 13 (upper inner lip), 14 (lower inner lip) |
| Brow raise | 55 (left brow), 159 (right eye upper lid) |
| Head tilt | 454 (right jaw end), 234 (left jaw end) |
| Eye openness | 159/145 (right), 386/374 (left) |

### 5. Smooth face values each frame

Raw readings jump because detections are sparse (~10 FPS) but `draw()` runs at 60 FPS. Lerping smooths the transition:

```js
face_mouthOpen = lerp(face_mouthOpen, raw_mouthOpen, FACE_LERP);
```

`FACE_LERP = 0.25` means the display value moves 25% of the remaining gap each frame.

### 6. Drive star speed from face + mouse

```js
let faceBoost = face_mouthOpen * 4.5;
targetSpeedMultiplier = 1 + faceBoost; // base + mouth contribution
currentSpeedMultiplier = lerp(currentSpeedMultiplier, targetSpeedMultiplier, 0.15);
```

Mouse speed also raises the multiplier when the mouse moves fast.

### 7. Star movement with head-tilt bias

Inside `Star.move()`, `face_headTilt` adds a vertical drift so stars slide left or right depending on which way you tilt your head:

```js
move(speedMultiplier) {
  this.x += this.baseSpeedX * speedMultiplier;
  this.y += (this.baseSpeedY + face_headTilt * 0.5) * speedMultiplier;
  // wrap edges
}
```

### 8. Spatial grid for connection lines

Checking every pair of stars is O(n²). The project uses a spatial hash: stars are sorted into grid cells and only cells within ±1 of each star's cell are checked for neighbours.

```js
function buildGrid() {
  grid = {};
  for (let i = 0; i < stars.length; i++) {
    let cx = (stars[i].x / gridCellSize) | 0; // fast floor
    let cy = (stars[i].y / gridCellSize) | 0;
    // store index in grid[cx+','+cy]
  }
}
```

`brow_raise` widens the connection distance, so raising your eyebrows makes more lines appear.

### 9. Cached gradient background

Recomputing a canvas gradient every frame is expensive. The gradient is drawn to an off-screen `createGraphics` buffer and only rebuilt when the theme or canvas size changes:

```js
if (!gradientBuffer || cachedTheme !== currentTheme || cachedW !== width) {
  gradientBuffer = createGraphics(width, height);
  // draw gradient to gradientBuffer
  cachedTheme = currentTheme; cachedW = width; cachedH = height;
}
image(gradientBuffer, 0, 0);
```

### 10. Blink events

A blink is detected on the closing edge (same pattern as Easy):

```js
if (lClosed && !leftBlinkWas) blinkBurst = true;
leftBlinkWas = lClosed;
```

`blinkBurst` spawns 14 new stars in a random burst location in the next `draw()` frame.

### 11. Warp effect

When both eyes are wide open **and** the mouth is open (`mouthOpen > 0.4`), an expanding ellipse warp animation plays:

```js
if (raw_leftEye > WARP_THRESHOLD && raw_rightEye > WARP_THRESHOLD
    && raw_mouthOpen > 0.4 && !warpActive) {
  warpActive = true;
}
```

---

## Core ml5 API used

| Call | What it does |
|---|---|
| `ml5.faceMesh({ maxFaces, flipped })` | Creates the model |
| `faceMesh.detect(video, callback)` | One-shot inference |
| `results[0].keypoints` | 468 `{x, y, z}` landmarks in video coordinate space |

---

## Common pitfalls

- **Frame rate drop** — if you switch to `detectStart`, inference queues up every frame and the page lags. Always throttle with `detect()` + a timer.
- **Jittery values** — raw face metrics fluctuate between detections. Always lerp them toward their raw target each frame.
- **Stars cap** — `stars.splice(0, stars.length - 650)` keeps the array from growing unboundedly when blink bursts keep firing.
