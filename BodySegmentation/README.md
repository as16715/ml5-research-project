# Body Segmentation — Easy: Person Aura

Separates the person from the background in real time using ml5 `bodySegmentation` (SelfieSegmentation) and draws an animated colour aura over the detected person mask.

---

## Dependencies

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.3/p5.min.js"></script>
<script src="https://unpkg.com/ml5@1/dist/ml5.min.js"></script>
```

No additional files are needed. Everything runs in one `index.html`.

---

## How to run

1. Serve the folder over `http://` or `https://` — camera and segmentation models require a secure context. The quickest way is `npx serve .` or VS Code Live Server.
2. Open the page and allow camera access.
3. Stand in front of the camera and watch the colour aura cycle over your silhouette.

---

## Key variables

| Variable | Purpose |
|---|---|
| `video` | p5 capture element — the live webcam feed |
| `segmenter` | The ml5 bodySegmentation model instance |
| `segmentation` | The latest result object; `segmentation.mask` is the pixel mask |
| `modelReady` | `true` once the ml5 callback fires |
| `detectStarted` | Guards against calling `detectStart` before both model and video are ready |

---

## Step-by-step implementation

### 1. Create the canvas and capture video

```js
function setup() {
  const canvas = createCanvas(512, 384);
  canvas.parent(document.querySelector("main"));

  video = createCapture(VIDEO, { flipped: true }); // mirror like a selfie camera
  video.size(width, height);
  video.hide(); // hide the raw <video> element; we draw it ourselves
}
```

### 2. Load the segmentation model

Pass the model name, a config object, and a callback that fires when the model is ready. `flipped: true` keeps the mask coordinate system aligned with the mirrored video.

```js
segmenter = ml5.bodySegmentation("SelfieSegmentation", {
  runtime: "tfjs",
  modelType: "general",
  maskType: "person",
  flipped: true
}, () => {
  modelReady = true;
  startDetectionIfReady();
});
```

Available model names: `"SelfieSegmentation"`, `"BodyPix"`.

### 3. Guard the detection start

Both the model and the video element must be ready before calling `detectStart`. We use two callbacks and a shared guard function:

```js
video.elt.onloadeddata = () => {
  startDetectionIfReady();
};

function startDetectionIfReady() {
  if (detectStarted || !modelReady || !video || video.width === 0) return;
  detectStarted = true;
  segmenter.detectStart(video, (result, error) => {
    if (error) return;
    segmentation = result; // result.mask is the ImageData/p5.Image of the person
  });
}
```

`detectStart` runs the segmenter on every available frame and calls the callback with each new result.

### 4. Draw the video and the aura

Every `draw()` call:

1. Draw the raw video as the background.
2. If the mask exists, animate an RGB colour using `sin()` on `frameCount` and apply it as a `tint()` before drawing the mask on top.
3. Call `noTint()` afterwards so later drawing calls are unaffected.

```js
function draw() {
  image(video, 0, 0, width, height); // background video

  if (!segmentation || !segmentation.mask) {
    // show status text while waiting
    return;
  }

  const auraR = 140 + 80 * sin(frameCount * 0.03);
  const auraG =  80 + 90 * sin(frameCount * 0.05 + 0.5);
  const auraB = 220 + 30 * sin(frameCount * 0.04 + 1.2);

  tint(auraR, auraG, auraB, 155); // 155 = semi-transparent
  image(segmentation.mask, 0, 0, width, height);
  noTint();
}
```

The mask image has full pixels where a person is detected and transparent pixels elsewhere, so drawing it on top of the video only colours the person.

### 5. Timeout fallback

A `setTimeout` after 15 seconds updates the status text if the model never loaded — useful for catching network or HTTPS issues without leaving the user with a silent blank screen.

---

## Core ml5 API used

| Call | What it does |
|---|---|
| `ml5.bodySegmentation(model, config, callback)` | Loads the model. Callback fires when ready. |
| `segmenter.detectStart(video, callback)` | Begins continuous segmentation. Callback receives `(result, error)`. |
| `result.mask` | A p5-compatible image representing the detected person region. |

---

## Common pitfalls

- **Blank screen / model never loads** — the page must be served over `http://localhost` or `https://`. Opening the file directly as `file://` blocks camera access.
- **`detectStart` called before video is ready** — always wait for `video.elt.onloadeddata` (or check `video.width !== 0`) before starting detection.
- **Mask appears offset** — ensure both the `createCapture` call and the `bodySegmentation` config both use `flipped: true` so coordinates stay in sync.
