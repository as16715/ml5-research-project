# Pose Estimation — Easy: Joint Radar

Uses ml5 `bodyPose` (MoveNet) to track body keypoints from the webcam. The left and right wrist Y-positions are mapped to the radius of two coloured circles — lift your wrists to grow the circles.

---

## Dependencies

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.3/p5.min.js"></script>
<script src="https://unpkg.com/ml5@1/dist/ml5.min.js"></script>
```

---

## How to run

1. Open `index.html` served over HTTP.
2. Allow camera access.
3. Stand back so your full upper body is in frame. Raise and lower your wrists.

---

## Key variables

| Variable | Purpose |
|---|---|
| `bodyPose` | The ml5 bodyPose model instance |
| `video` | Webcam capture |
| `poses` | Array of detected poses; only `poses[0]` is used |

---

## Step-by-step implementation

### 1. Load the model in `preload()`

```js
function preload() {
  bodyPose = ml5.bodyPose("MoveNet", { flipped: true });
}
```

`"MoveNet"` is the model name. The alternative is `"BlazePose"` which provides more keypoints including fingers and face. `flipped: true` mirrors the coordinate system to match the mirrored video.

### 2. Start detection in `setup()`

```js
bodyPose.detectStart(video, (results) => {
  poses = results || [];
});
```

The callback fires on every available frame and replaces the `poses` array. Multiple poses may be returned if multiple people are visible; this project uses only `poses[0]`.

### 3. Read specific keypoints

MoveNet returns 17 keypoints per person. Each keypoint is an object with `x`, `y`, and `confidence` properties. Keypoints are accessed by name:

```js
const pose = poses[0];
const leftWrist  = pose.left_wrist;
const rightWrist = pose.right_wrist;
```

**Always check confidence** before using a keypoint — if a joint is occluded or out of frame, it will have a low confidence score and its position will be inaccurate:

```js
if (leftWrist && leftWrist.confidence > 0.2) {
  // safe to use leftWrist.x and leftWrist.y
}
```

### 4. Map wrist height to circle radius

`height - wrist.y` converts from screen Y (which increases downward) to a "height above floor" value. `map()` then scales this to a useful radius range:

```js
leftRadius = map(height - leftWrist.y, 0, height, 20, 120);
```

When the wrist is at the bottom of the canvas (`wrist.y ≈ height`), `height - wrist.y ≈ 0` so radius = 20. When the wrist is near the top (`wrist.y ≈ 0`), radius = 120.

### 5. Draw the circles

```js
noFill();
stroke(90, 220, 130);
strokeWeight(4);
circle(leftWrist.x, leftWrist.y, leftRadius);
```

The circle is centred on the wrist position so it follows the hand in real time.

### 6. "No pose" message

When `poses.length === 0`, draw a helper overlay:

```js
function overlayMessage(msg) {
  fill(0, 140);
  rect(0, 0, width, height);
  fill(255);
  textAlign(CENTER, CENTER);
  text(msg, width / 2, height / 2);
}
```

---

## MoveNet keypoint name reference

```
nose, left_eye, right_eye, left_ear, right_ear
left_shoulder, right_shoulder
left_elbow, right_elbow
left_wrist, right_wrist
left_hip, right_hip
left_knee, right_knee
left_ankle, right_ankle
```

All positions are in canvas coordinate space when `flipped: true` is set — no remapping needed.

---

## Core ml5 API used

| Call | What it does |
|---|---|
| `ml5.bodyPose("MoveNet", { flipped })` | Loads the model |
| `bodyPose.detectStart(video, callback)` | Continuous detection; callback receives `results[]` |
| `results[0].left_wrist` | `{x, y, confidence}` for the left wrist keypoint |

---

## Common pitfalls

- **Keypoints at (0, 0)** — a keypoint with `confidence < 0.2` is unreliable. Always gate on confidence before using the position.
- **Y axis is inverted** — canvas Y increases downward. "Raise your hand" means decreasing `wrist.y`. Use `height - wrist.y` when you need a value that increases with hand height.
- **Multiple poses** — if two people are in frame, `poses[0]` may not be the person you expect. For a single-user project, ask the user to be the only person in frame.
