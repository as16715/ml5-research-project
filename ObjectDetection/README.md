# Object Detection — Easy: Biggest Box

Uses ml5 `objectDetection` (COCO-SSD) to detect multiple objects in the webcam feed simultaneously, then highlights the single largest detected object with a gold bounding box while all others get a thin blue outline.

---

## Dependencies

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.3/p5.min.js"></script>
<script src="https://unpkg.com/ml5@1/dist/ml5.min.js"></script>
```

---

## How to run

1. Open `index.html` in any browser served over HTTP.
2. Allow camera access and wait for "Loading COCO-SSD…" to clear.
3. Hold objects in front of the camera — larger objects get the gold spotlight box.

---

## Key variables

| Variable | Purpose |
|---|---|
| `detector` | The ml5 objectDetection model instance |
| `detections` | Array of detection result objects from the latest frame |
| `modelReady` | `true` once the COCO-SSD callback fires |

---

## Step-by-step implementation

### 1. Load the model in `setup()`

Unlike `imageClassifier`, `objectDetection` is loaded in `setup()` (not `preload()`) because the detection is started immediately in the model-ready callback rather than in a separate step.

```js
detector = ml5.objectDetection("cocossd", () => {
  modelReady = true;
  detector.detectStart(video, gotDetections);
});
```

Available model strings: `"cocossd"` (80 COCO object classes), `"yolo"`.

### 2. Receive continuous detections

`detectStart` fires the callback with every new detection result. The callback simply replaces the `detections` array:

```js
function gotDetections(results) {
  detections = results || [];
}
```

Each item in `results` has:

| Property | Type | Description |
|---|---|---|
| `label` | string | Class name (e.g. `"person"`, `"bottle"`) |
| `confidence` | number | 0–1 |
| `x`, `y` | number | Top-left corner of bounding box in canvas pixels |
| `width`, `height` | number | Box dimensions |

Coordinates are already in canvas space — no remapping needed.

### 3. Find the largest detection

Iterate detections each frame and track the one with the greatest `width * height`:

```js
let biggest = null;
let biggestArea = 0;

for (const item of detections) {
  const area = item.width * item.height;
  if (area > biggestArea) {
    biggestArea = area;
    biggest = item;
  }
  // draw dim box for every detection
  stroke(70, 220, 255, 180);
  strokeWeight(1.5);
  noFill();
  rect(item.x, item.y, item.width, item.height);
}
```

### 4. Highlight the biggest object

After the loop, draw the gold spotlight box and label:

```js
if (biggest) {
  stroke(255, 190, 70);
  strokeWeight(4);
  noFill();
  rect(biggest.x, biggest.y, biggest.width, biggest.height);
  // label text below the box
}
```

### 5. Waiting state

While `modelReady` is `false`, a loading overlay is drawn over the video:

```js
if (!modelReady) {
  fill(0, 160);
  rect(0, 0, width, height);
  fill(255);
  textAlign(CENTER, CENTER);
  text("Loading COCO-SSD...", width / 2, height / 2);
  return;
}
```

---

## Core ml5 API used

| Call | What it does |
|---|---|
| `ml5.objectDetection("cocossd", callback)` | Loads the model; callback fires when ready |
| `detector.detectStart(video, callback)` | Continuous detection; callback receives `results[]` |
| `results[i].label` | Class name string |
| `results[i].x`, `.y`, `.width`, `.height` | Bounding box in canvas pixels |

---

## COCO-SSD vs imageClassifier

| | `imageClassifier` | `objectDetection` |
|---|---|---|
| Output | One label for the whole frame | Multiple boxes with labels |
| Speed | Faster | Slower (more computation per frame) |
| Spatial info | None | Bounding box for each detection |
| Use when | "What is this?" | "Where are the objects?" |

---

## Common pitfalls

- **`detections` is sometimes empty** — COCO-SSD only returns detections above its internal confidence threshold. No return does not mean an error.
- **Bounding box coordinates are already scaled** — unlike faceMesh, objectDetection coordinates are in canvas space. Do not remap them.
- **`detectStart` vs `detect`** — `detectStart` streams results. If you need a single snapshot (e.g., button-triggered), use `detector.detect(video, callback)` instead.
