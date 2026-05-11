# Image Classification — Advanced: Scavenger Hunt

A timed game built on ml5 `imageClassifier` (MobileNet). A random household item is requested each round; the player has 20 seconds to find it and hold it in front of the camera. Consecutive matching detections (debounce) register as a hit and award points scaled by remaining time. The full game lasts 2 minutes.

---

## Dependencies

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.3/p5.min.js"></script>
<script src="https://unpkg.com/ml5@1/dist/ml5.min.js"></script>
```

---

## How to run

1. Open `index.html` in any browser served over HTTP.
2. Allow camera access.
3. Wait for "Start Game" to appear (model is ready).
4. Click Start and find the requested item within the round timer.

---

## Configuration constants (top of `<script>`)

| Constant | Default | Purpose |
|---|---|---|
| `GAME_DURATION_MS` | `120000` | Total game length (2 minutes) |
| `ROUND_DURATION_MS` | `20000` | Time given per target |
| `HIT_CONFIDENCE` | `0.30` | Minimum classifier confidence to count as a sighting |
| `HIT_FRAMES` | `3` | Consecutive matching frames needed to register a hit |
| `HISCORE_KEY` | `"ml5-scavenger-hiscore"` | localStorage key for the high score |

---

## The item pool

`ITEMS` is an array of objects. Each entry describes one target:

```js
const ITEMS = [
  { name: "Bottle",   emoji: "BOTTLE", keys: ["bottle", "flask"] },
  { name: "Computer Mouse", emoji: "MOUSE", keys: ["mouse"] },
  // ...
];
```

`keys` lists lowercase substrings that may appear in the MobileNet label. The current label is matched against all keys with `.includes()`. Keeping multiple keys per item accommodates the verbosity of ImageNet labels (e.g. `"water_bottle"`, `"wine_bottle"` both match `"bottle"`).

---

## Key variables

| Variable | Purpose |
|---|---|
| `classifier` | ml5 imageClassifier model |
| `video` | Webcam capture |
| `label`, `confidence` | Latest classifier output |
| `phase` | Game state: `"idle"` → `"playing"` → `"over"` |
| `score` | Running total for the current game |
| `gameStartedAt` | `millis()` when the game started |
| `roundStartedAt` | `millis()` when the current round started |
| `currentTarget` | The active `ITEMS` entry the player must find |
| `recentTargets` | Last 3 target names — excluded from random selection to avoid repetition |
| `consecutiveHits` | Frames in a row where the classifier matched the target |

---

## Step-by-step implementation

### 1. Load the model in `preload()`

```js
function preload() {
  classifier = ml5.imageClassifier("MobileNet", () => {
    modelReady = true;
    showStartScreen();
  });
}
```

The callback updates the overlay to show the Start button once the model is ready.

### 2. Continuous classification loop

Same recursive pattern as the Easy project — classify one frame, call back, classify again:

```js
function classifyVideo() {
  classifier.classify(video, gotResult);
}

function gotResult(results) {
  if (results && results.length > 0) {
    label = results[0].label;
    confidence = results[0].confidence;
    if (phase === "playing") checkForHit();
  }
  classifyVideo();
}
```

Classification is only acted upon during the `"playing"` phase to avoid spurious events on the start/end screens.

### 3. Game state machine

```
idle  ──[Start clicked]──▶  playing  ──[game timer expires]──▶  over
                                │
                      [round timer expires or hit]
                                │
                       pickNextTarget() ◀──────┘
```

State lives in the `phase` variable. DOM overlays are shown/hidden based on it.

### 4. Hit detection with debounce

A single-frame match is unreliable — MobileNet fluctuates. Requiring `HIT_FRAMES` consecutive matches filters noise:

```js
function checkForHit() {
  const lower = label.toLowerCase();
  const matched = currentTarget.keys.some(k => lower.includes(k));

  if (matched && confidence >= HIT_CONFIDENCE) {
    consecutiveHits++;
    if (consecutiveHits >= HIT_FRAMES) awardHit();
  } else {
    consecutiveHits = 0; // reset on any non-matching frame
  }
}
```

### 5. Scoring

Points decrease with remaining time so fast finds are rewarded:

```js
function awardHit() {
  const roundLeft = Math.max(0, ROUND_DURATION_MS - (millis() - roundStartedAt));
  const seconds = Math.ceil(roundLeft / 1000);
  const points = 100 + seconds * 5; // 100 base + 5 per second left
  score += points;
  pickNextTarget();
}
```

### 6. Target selection without repeats

The last 3 targets are remembered and excluded from the random pick. If the pool is exhausted (fewer than 4 items total), the full list is used:

```js
function pickNextTarget() {
  let pool = ITEMS.filter(i => !recentTargets.includes(i.name));
  if (pool.length === 0) pool = ITEMS;
  currentTarget = pool[Math.floor(Math.random() * pool.length)];
  recentTargets.push(currentTarget.name);
  if (recentTargets.length > 3) recentTargets.shift();
  consecutiveHits = 0;
  roundStartedAt = millis();
}
```

### 7. Timer display and round transitions

`updateTimers()` is called every frame during play. It computes remaining milliseconds from `millis()` differences and switches the round chip to a red "warn" style in the last 5 seconds:

```js
function updateTimers() {
  const gameLeft  = Math.max(0, GAME_DURATION_MS - (millis() - gameStartedAt));
  const roundLeft = Math.max(0, ROUND_DURATION_MS - (millis() - roundStartedAt));

  if (gameLeft <= 0) return endGame();
  if (roundLeft <= 0) { showFeedback("MISS", "miss"); pickNextTarget(); }
}
```

### 8. High score persistence

`localStorage` is used to persist the best score across page loads:

```js
const prev = Number(localStorage.getItem(HISCORE_KEY) || 0);
if (score > prev) localStorage.setItem(HISCORE_KEY, String(score));
```

---

## Core ml5 API used

| Call | What it does |
|---|---|
| `ml5.imageClassifier("MobileNet", callback)` | Loads MobileNet; callback fires when ready |
| `classifier.classify(video, callback)` | Classifies one frame |
| `results[0].label` | Top label string |
| `results[0].confidence` | Confidence (0–1) |

---

## Common pitfalls

- **Hit registers while on start/end screens** — only call `checkForHit()` when `phase === "playing"`.
- **Timer drifts** — do not use `setInterval` for game timers in a p5 draw loop. Use `millis()` and compute elapsed time; it stays perfectly in sync with the frame.
- **Model classifies slowly** — MobileNet classifies one frame per call. On slow devices the loop may lag. The consecutive-frame debounce naturally adapts: if inference is slow, `HIT_FRAMES` hits will take longer, effectively raising the required hold time.
