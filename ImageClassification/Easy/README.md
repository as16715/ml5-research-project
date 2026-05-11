# Image Classification — Easy: Label Reactor

Uses ml5 `imageClassifier` (MobileNet) to continuously classify whatever the webcam sees and reacts visually: the canvas background washes with a colour matching the detected object, and a bold label tag is displayed.

---

## Dependencies

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.3/p5.min.js"></script>
<script src="https://unpkg.com/ml5@1/dist/ml5.min.js"></script>
```

---

## How to run

Open `index.html` in any browser served over HTTP. Allow camera access. Hold household objects in front of the camera.

---

## Key variables

| Variable | Purpose |
|---|---|
| `classifier` | The ml5 imageClassifier model |
| `video` | Webcam capture element |
| `label` | Latest predicted label string |
| `confidence` | Latest prediction confidence (0–1) |
| `palettes` | Object mapping label keywords to `[r, g, b]` background colours |
| `tags` | Object mapping label keywords to short display strings |

---

## Step-by-step implementation

### 1. Load the model in `preload()`

```js
function preload() {
  classifier = ml5.imageClassifier("MobileNet");
}
```

`"MobileNet"` downloads the pre-trained MobileNet weights from a CDN. Other supported model strings include `"DarkNet"` and `"DoodleNet"`.

### 2. Set up video and start classifying in `setup()`

```js
function setup() {
  const canvas = createCanvas(640, 480);
  video = createCapture(VIDEO, { flipped: true });
  video.size(width, height);
  video.hide();
  classifyVideo();
}
```

### 3. Run the classification loop

ml5 `imageClassifier.classify` takes a source and a callback, then calls back once with the top results. To keep classifying continuously, call it again inside the callback — this is the standard ml5 continuous-classification pattern:

```js
function classifyVideo() {
  classifier.classify(video, gotResult);
}

function gotResult(results) {
  if (results && results.length > 0) {
    label = results[0].label;
    confidence = results[0].confidence;
  }
  classifyVideo(); // immediately queue the next classification
}
```

`results` is an array sorted by descending confidence. `results[0]` is the best guess.

### 4. Map labels to colours using keyword matching

MobileNet returns verbose ImageNet labels like `"laptop, laptop computer"`. The `pickByLabel` helper does a partial `.includes()` match so a single keyword covers many label variants:

```js
const palettes = {
  person: [40, 102, 180],
  bottle: [50, 145, 180],
  banana: [230, 190, 55],
  // ...
};

function pickByLabel(source, fallback) {
  const lower = label.toLowerCase();
  for (const key in source) {
    if (lower.includes(key)) return source[key];
  }
  return fallback;
}
```

### 5. Draw the scene in `draw()`

Every frame:
1. Set background to the colour for the current label.
2. Draw the video on top of the background.
3. Draw a dark footer bar.
4. Draw label and confidence text.

```js
function draw() {
  const bgColor = pickByLabel(palettes, [25, 30, 45]);
  background(bgColor[0], bgColor[1], bgColor[2]);
  image(video, 0, 0, width, height);
  // footer text ...
}
```

The background is painted before the video so it appears only at the edges if the video fills the canvas, or as the full background when video is letterboxed.

---

## Core ml5 API used

| Call | What it does |
|---|---|
| `ml5.imageClassifier("MobileNet")` | Loads the model (call in `preload()`) |
| `classifier.classify(source, callback)` | Classifies one frame of `source`; callback receives `results[]` |
| `results[0].label` | Top predicted label string |
| `results[0].confidence` | Confidence for that label (0–1) |

---

## Extending the colour map

To add a new object colour, add a key–value pair to `palettes` and `tags`:

```js
const palettes = {
  // ...existing entries...
  cat: [150, 77, 200]
};
const tags = {
  cat: "CAT"
};
```

The key must be a lowercase substring of the MobileNet label that will be returned. Check [ImageNet label list](https://github.com/nicklockwood/iphone-classifier/blob/master/labels.txt) to find the exact string.

---

## Common pitfalls

- **Model loads slowly** — MobileNet is ~14 MB. On the first load it downloads from unpkg. Subsequent loads are cached by the browser.
- **Label never matches custom palette** — MobileNet returns full ImageNet labels like `"water bottle"`, not short words. Use a substring that appears in the actual returned label.
- **Classify loop stops** — if the callback is not called again with `classifyVideo()`, classification stops. Always call it at the end of `gotResult`.
