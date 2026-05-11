# Hand Pose — Advanced: Fruit Slice Trail

A Fruit Ninja-style game built with ml5 `handPose`. Fruit sprites fly upward under gravity, and fast swipes of the index finger slice them in two. Each slice applies canvas clipping to split the fruit image into two halves that fly apart.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | Layout, dependencies, and all game logic |
| `Images/banana.png` | Fruit sprite |
| `Images/orange.png` | Fruit sprite |
| `Images/strawberry.png` | Fruit sprite |

---

## Dependencies

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.3/p5.min.js"></script>
<script src="https://unpkg.com/ml5@1/dist/ml5.min.js"></script>
```

---

## How to run

1. Serve with any local HTTP server (fruit sprites need HTTP to load).
2. Allow camera access.
3. Move your index finger quickly across a fruit to slice it.

---

## Key constants

| Constant | Default | Purpose |
|---|---|---|
| `GRAVITY` | `0.35` | Downward acceleration applied to every fruit and piece each frame |
| `SLICE_SPEED` | `12` | Minimum pixels-per-frame finger movement to trigger a slice check |
| `TRAIL_DECAY` | `14` | Alpha lost per frame on each trail point |

---

## Key variables

| Variable | Purpose |
|---|---|
| `handPose` | ml5 handPose model |
| `hands` | Latest hand detection results |
| `fruits` | Array of active `Fruit` instances |
| `pieces` | Array of `FruitPiece` (half-fruit) instances |
| `slashes` | Short-lived `SlashEffect` line flashes at slice position |
| `trail` | Array of `{x, y, life}` points tracing the finger |
| `lastFinger` | Previous frame's finger position (for velocity calculation) |
| `fruitSprites` | Array of `{file, img}` objects loaded in `preload()` |
| `nextSpawnFrame` | `frameCount` value at which the next fruit spawns |
| `score` | Running slice count |

---

## Step-by-step implementation

### 1. Load the model and sprite images in `preload()`

```js
function preload() {
  handPose = ml5.handPose({ maxHands: 1, flipped: true });

  fruitSprites = FRUIT_FILES.map(file => ({
    file,
    img: loadImage(`./Images/${file}`)
  }));
}
```

`loadImage` is a p5 function that blocks `setup()` until all images are ready when called inside `preload()`.

### 2. Start the detection loop

```js
handPose.detectStart(video, (results) => {
  hands = results || [];
});
```

The callback fires on every available video frame and simply replaces `hands`. The game logic in `draw()` reads from it.

### 3. Fruit spawning

Fruit spawns at a random X position below the canvas with an upward velocity:

```js
function spawnFruit() {
  const pick = random(fruitSprites);
  const fruit = new Fruit(pick.img, w, h);
  fruit.pos = createVector(random(80, width - 80), height + random(40, 120));
  fruit.vel = createVector(random(-2.4, 2.4), random(-18, -13)); // upward
  fruits.push(fruit);
}
```

Fruit spawning is scheduled by comparing `frameCount` to `nextSpawnFrame` (set 26–60 frames in the future). A 25% chance spawns a second fruit simultaneously.

### 4. Fruit physics in `Fruit.update()`

Each frame, gravity is added to the Y velocity and the result added to position:

```js
update() {
  this.vel.y += GRAVITY;  // accelerate downward
  this.pos.add(this.vel);
  this.rotation += this.spin;
}
```

Fruit is removed when it falls far enough below the canvas.

### 5. Reading the finger and detecting a slice

Index fingertip = `hands[0].keypoints[8]`.

```js
const tip = hands[0].keypoints[8];
const current = createVector(tip.x, tip.y);

if (lastFinger) {
  const speed = p5.Vector.dist(current, lastFinger);
  if (speed > SLICE_SPEED) {
    attemptSlice(lastFinger, current, angle); // angle = atan2 of movement
  }
}
lastFinger = current;
```

### 6. Hit detection — point-to-segment distance

`attemptSlice` checks each fruit by computing the minimum distance from the fruit's centre to the slice line segment. If it is within the fruit's radius, the fruit is sliced.

```js
function segmentDistance(point, start, end) {
  const l2 = pow(dist(start.x, start.y, end.x, end.y), 2);
  let t = ((point.x - start.x) * (end.x - start.x) +
           (point.y - start.y) * (end.y - start.y)) / l2;
  t = constrain(t, 0, 1); // clamp to segment (not infinite line)
  const projX = start.x + t * (end.x - start.x);
  const projY = start.y + t * (end.y - start.y);
  return dist(point.x, point.y, projX, projY);
}
```

### 7. Splitting a fruit with canvas clipping

`FruitPiece` draws one half of the original image by clipping the canvas with the 2D context API before calling `image()`. The clip rectangle is rotated to align with the slice direction, so the cut always follows the swipe angle regardless of the fruit's own rotation.

```js
draw() {
  push();
  translate(this.pos.x, this.pos.y);
  rotate(this.rotation);
  const ctx = drawingContext; // raw 2D canvas context
  ctx.save();
  const localAngle = this.sliceAngle - this.rotation;
  ctx.rotate(-localAngle); // align clip to slice direction
  ctx.beginPath();
  if (this.side > 0) {
    ctx.rect(-L, 0, L * 2, L * 2);  // top half
  } else {
    ctx.rect(-L, -L * 2, L * 2, L * 2); // bottom half
  }
  ctx.clip();
  ctx.rotate(localAngle); // restore fruit rotation inside clip
  image(this.img, 0, 0, this.w, this.h);
  ctx.restore();
  pop();
}
```

Two `FruitPiece` instances are created per slice — one with `side = 1` (top half), one with `side = -1` (bottom half). Their velocities are offset along the normal to the slice direction so they fly apart:

```js
const normal = createVector(-sin(angle), cos(angle));
// piece 1 gets +normal velocity, piece 2 gets -normal velocity
```

### 8. The finger trail

Each frame a point is pushed to `trail` at the current finger position. Points lose `TRAIL_DECAY` alpha per frame and are spliced out when they reach zero. The trail is drawn as connected line segments with width and colour driven by the point's remaining life:

```js
stroke(130, 220, 255, alpha);
strokeWeight(map(alpha, 0, 255, 1.2, 4.5));
line(a.x, a.y, b.x, b.y);
```

---

## Core ml5 API used

| Call | What it does |
|---|---|
| `ml5.handPose({ maxHands, flipped })` | Creates the model |
| `handPose.detectStart(video, callback)` | Continuous detection; callback receives `results[]` |
| `results[0].keypoints[8]` | Index fingertip `{x, y}` in canvas space |

---

## Common pitfalls

- **Fruit images not loading** — `loadImage` with a relative path requires an HTTP server. Opening `file://` will fail silently.
- **Slice fires every frame** — the velocity threshold (`SLICE_SPEED`) prevents slicing while the finger is stationary. If you lower it, add a cooldown timer.
- **Canvas clipping bleeds across frames** — always call `ctx.save()` before and `ctx.restore()` after setting a clip region. Forgetting `restore()` clips all subsequent drawing.
