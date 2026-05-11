# Hand Pose — Easy: Fingertip Trail

Tracks a single hand with ml5 `handPose`, reads the index fingertip keypoint, and draws a fading colour trail. Pinching the index finger and thumb together switches the trail from blue to orange.

---

## Dependencies

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.3/p5.min.js"></script>
<script src="https://unpkg.com/ml5@1/dist/ml5.min.js"></script>
```

---

## How to run

1. Open `index.html` in any browser (served over HTTP or HTTPS).
2. Allow camera access.
3. Hold one hand in front of the camera. Move your index finger to draw; pinch index + thumb to change trail colour.

---

## Key variables

| Variable | Purpose |
|---|---|
| `handPose` | The ml5 handPose model |
| `hands` | Array of detected hand results (capped at 1) |
| `points` | Array of `{x, y, pinching, life}` trail point objects |

---

## Step-by-step implementation

### 1. Load the model in `preload()`

```js
function preload() {
  handPose = ml5.handPose({
    maxHands: 1, // only track one hand — cheaper
    flipped: true // mirror coords to match mirrored video
  });
}
```

`maxHands: 1` cuts inference cost roughly in half compared to tracking two hands.

### 2. Start detection in `setup()`

```js
video = createCapture(VIDEO, { flipped: true });
video.size(width, height);
video.hide();

handPose.detectStart(video, (results) => {
  hands = results || [];
});
```

`detectStart` runs continuously and calls the callback with every new result. The callback simply replaces the `hands` array — the main `draw()` loop reads from it every frame.

### 3. Read keypoints in `draw()`

ml5 handPose returns 21 keypoints per hand, indexed 0–20. The two keypoints used here:

| Index | Landmark |
|---|---|
| 4 | Thumb tip |
| 8 | Index finger tip |

```js
const hand = hands[0];
const indexTip = hand.keypoints[8]; // {x, y, score}
const thumbTip = hand.keypoints[4];
```

Keypoints are already in **canvas coordinate space** when `flipped: true` is set — no remapping needed.

### 4. Detect pinch

Pinch is detected by measuring the Euclidean distance between the two fingertips. Under 35 pixels counts as a pinch:

```js
const pinchDistance = dist(indexTip.x, indexTip.y, thumbTip.x, thumbTip.y);
const isPinching = pinchDistance < 35;
```

### 5. Build the trail

Each frame a new point is pushed onto the `points` array with a starting `life` of 255:

```js
points.push({
  x: indexTip.x,
  y: indexTip.y,
  pinching: isPinching,
  life: 255
});
```

### 6. Draw and decay the trail

The array is iterated in reverse so splicing a spent point does not skip the next one. Each point loses 4 alpha per frame (255 / 4 ≈ 64 frames = ~1 second trail):

```js
for (let i = points.length - 1; i >= 0; i--) {
  const p = points[i];
  const base = p.pinching ? [255, 130, 100] : [110, 220, 255]; // orange or blue
  fill(base[0], base[1], base[2], p.life);
  circle(p.x, p.y, 12);

  p.life -= 4;
  if (p.life <= 0) points.splice(i, 1);
}
```

A dark semi-transparent overlay (`fill(10, 120)` rect over the full canvas) each frame dims previous content, giving the video a motion-blur look that complements the trail.

---

## Core ml5 API used

| Call | What it does |
|---|---|
| `ml5.handPose({ maxHands, flipped })` | Creates the model |
| `handPose.detectStart(video, callback)` | Continuous detection; callback receives `results[]` |
| `results[0].keypoints[n]` | `{x, y, score}` for landmark index `n` |

---

## Full keypoint index reference

```
0  Wrist
1–4   Thumb (CMC → tip)
5–8   Index (MCP → tip)
9–12  Middle
13–16 Ring
17–20 Pinky
```

---

## Common pitfalls

- **`hands[0].keypoints` is undefined** — always check `hands.length > 0 && hands[0].keypoints` before accessing keypoints.
- **Trail grows forever** — every frame pushes a point. The `life -= 4` decay and subsequent splice keep the array bounded, but if you reduce the decay rate remember to also reduce the max trail length or add a hard cap.
- **Pinch jitters** — if the threshold (35 px) is too tight for your camera resolution, increase it. Alternatively, debounce pinch with a consecutive-frame counter.
