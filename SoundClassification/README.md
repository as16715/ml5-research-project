# Sound Classification — Easy: Sound Color

Uses ml5 `soundClassifier` (SpeechCommands18w) to continuously classify microphone input. The detected sound label drives the canvas background colour and the radius of an animated pulse circle.

---

## Dependencies

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.3/p5.min.js"></script>
<script src="https://unpkg.com/ml5@0.12.2/dist/ml5.min.js"></script>
```

**Important:** `soundClassifier` is only available in ml5 **v0.12.2**. It was removed from ml5 v1. Pin the version explicitly — do not use `ml5@1` or `ml5@latest` for this project.

---

## How to run

1. Serve `index.html` over HTTP (or `localhost`). Microphone requires a secure context.
2. Wait for "Start Microphone" button to become active (model loaded).
3. Click **Start Microphone** and allow browser microphone access.
4. Clap, whistle, say "yes" or "no", or make other sounds.

---

## Key variables

| Variable | Purpose |
|---|---|
| `classifier` | ml5 soundClassifier model instance |
| `isModelReady` | `true` once the `modelLoaded` callback fires |
| `started` | `true` after microphone permission is granted and `classify` begins |
| `currentLabel` | Latest classification label string |
| `confidence` | Latest classification confidence (0–1) |
| `heardAnyResult` | `true` after the first `gotSound` callback, used to suppress the hint message |
| `labelColors` | Object mapping label keywords to `[r, g, b]` arrays |

---

## Step-by-step implementation

### 1. Load the model in `setup()`

```js
function setup() {
  const canvas = createCanvas(640, 320);

  classifier = ml5.soundClassifier("SpeechCommands18w", {
    probabilityThreshold: 0.15,
    overlapFactor: 0.5
  }, modelLoaded);
}
```

`"SpeechCommands18w"` is a pre-trained model that recognises 18 words and sounds including "yes", "no", and common noises. Options:

| Option | Effect |
|---|---|
| `probabilityThreshold` | Minimum confidence before a result is reported (0–1) |
| `overlapFactor` | How much consecutive audio windows overlap (0–1); higher = more responsive but more CPU |

The third argument is the model-ready callback.

### 2. Enable the button when the model is ready

```js
function modelLoaded() {
  isModelReady = true;
  currentLabel = "Model ready - press Start Microphone";
  startBtn.disabled = false;
  startBtn.textContent = "Start Microphone";
}
```

The button starts disabled. Only enabling it inside `modelLoaded` prevents users from clicking before the model is ready.

### 3. Request microphone permission explicitly

Browsers block microphone access without a user gesture. The click handler performs a full permission flow:

```js
async function startListening() {
  if (!window.isSecureContext) {
    currentLabel = "Microphone needs https or localhost";
    return;
  }

  // Probe permission with a short stream, then immediately stop it
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());

  // p5's userStartAudio() satisfies the AudioContext user-gesture requirement
  await userStartAudio();
  classifier.classify(gotSound);

  started = true;
}
```

The `navigator.mediaDevices.getUserMedia` call triggers the browser's permission prompt. The stream is immediately stopped — its only job is to get the user to click Allow. `userStartAudio()` (provided by p5.js) then resumes the AudioContext which ml5 needs internally.

### 4. Receive classification results

`classify` fires the callback continuously with the latest results:

```js
function gotSound(error, results) {
  if (error) {
    currentLabel = "Audio stream error.";
    return;
  }
  heardAnyResult = true;
  currentLabel = results[0].label;
  confidence = results[0].confidence;
}
```

`results` is sorted by descending confidence. `results[0]` is the top prediction.

### 5. Map labels to colours

A keyword lookup matches the label string to a colour:

```js
const labelColors = {
  clap:    [255, 125, 76],
  whistle: [90,  170, 255],
  yes:     [130, 220, 130],
  no:      [235, 110, 110],
  // ...
};

function colorFromLabel() {
  const lower = currentLabel.toLowerCase();
  for (const key in labelColors) {
    if (lower.includes(key)) return labelColors[key];
  }
  return [42, 55, 78]; // default dark blue
}
```

Using `.includes()` handles label strings that contain the keyword anywhere (e.g. `"background_noise"`).

### 6. Draw the animated pulse in `draw()`

```js
function draw() {
  const c = colorFromLabel();
  background(c[0], c[1], c[2]);

  // Outer ring: radius driven by confidence, animated by frameCount
  const pulse = map(confidence, 0, 1, 35, 140);
  const wave  = 12 * sin(frameCount * 0.08);

  noFill();
  stroke(255, 210);
  strokeWeight(4);
  circle(width / 2, height / 2, pulse * 2 + wave + 20);

  // Second, dimmer outer ring
  stroke(255, 120);
  strokeWeight(2);
  circle(width / 2, height / 2, pulse * 2 + wave + 60);
}
```

`map(confidence, 0, 1, 35, 140)` converts the 0–1 confidence into a radius range. `sin(frameCount * 0.08)` adds a continuous gentle oscillation to both rings.

---

## Core ml5 API used

| Call | What it does |
|---|---|
| `ml5.soundClassifier("SpeechCommands18w", options, callback)` | Loads the model; callback fires when ready |
| `classifier.classify(callback)` | Starts continuous classification; callback receives `(error, results[])` |
| `results[0].label` | Top label string |
| `results[0].confidence` | Confidence for that label (0–1) |

---

## Common pitfalls

- **`soundClassifier` not found with ml5 v1** — this API was removed in ml5 v1. You must use `ml5@0.12.2` specifically. The `<script>` tag must pin the exact version.
- **AudioContext suspended** — browsers block audio until a user gesture. Always call `userStartAudio()` inside a click handler, not in `setup()` or `preload()`. Skipping this causes `classify` to silently produce no results.
- **Microphone denied** — if `getUserMedia` is rejected, catch the error and re-enable the button so the user can retry. Do not leave the button in a disabled state after a failure.
- **`probabilityThreshold` too high** — setting it above 0.5 on SpeechCommands18w often means no results are reported at all. 0.15 is a safe starting value.
- **Requires secure context** — `navigator.mediaDevices.getUserMedia` is blocked on plain `http://` (except `localhost`). Always test over `https://` or via a local dev server.
