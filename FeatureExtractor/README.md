# Feature Extractor — Easy: Two-Class Trainer

Uses ml5 `featureExtractor` to build a custom two-class image classifier entirely in the browser. You record webcam snapshots for class A and class B, hit Train, and the model immediately starts predicting which class the live camera feed belongs to. No server, no upload, no Python.

---

## Dependencies

```html
<!-- ml5 v0.12.2 is required — the featureExtractor API changed in later versions -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.3/p5.min.js"></script>
<script src="https://unpkg.com/ml5@0.12.2/dist/ml5.min.js"></script>
```

> **Note:** This project pins ml5 to `0.12.2`. The `featureExtractor` API was removed in ml5 v1.x. Do not upgrade the ml5 version without rewriting the model code.

---

## How to run

1. Serve from `http://localhost` or `https://` (camera requires a secure context).
2. Allow camera access.
3. Click **Add A Sample** several times with one object/gesture in view.
4. Change what you show the camera, then click **Add B Sample** several times.
5. Click **Train** and wait for the loss to reach `null` (training complete).
6. The model immediately classifies the live feed.

---

## Key variables

| Variable | Purpose |
|---|---|
| `featureExtractor` | The MobileNet feature extractor loaded via ml5 |
| `classifier` | The trainable classification head built on top of the extractor |
| `modelReady` | `true` once MobileNet has loaded |
| `isClassifying` | `true` while live prediction loop is running |
| `countA`, `countB` | Sample count per class, displayed in the status line |
| `label`, `confidence` | Latest prediction result |

---

## Step-by-step implementation

### 1. Load the feature extractor

`featureExtractor("MobileNet")` downloads the pre-trained MobileNet weights. The callback fires when ready.

```js
featureExtractor = ml5.featureExtractor("MobileNet", () => {
  modelReady = true;
  // enable buttons
});
```

MobileNet acts as a feature extractor: it takes an image and produces a dense feature vector without performing a final classification. You add your own small classifier on top.

### 2. Create the classification head

```js
classifier = featureExtractor.classification(video);
```

This creates a trainable KNN-style classifier that reads feature vectors from `featureExtractor` applied to `video`. The `video` argument tells ml5 which source to use when you later call `addImage` or `classify`.

### 3. Capture training samples

Each button click snapshots the current video frame and stores its feature vector under the given class label:

```js
function addSample(className) {
  classifier.addImage(className); // className = "A" or "B"
  countA++;  // or countB++
}
```

You need at least one sample per class before training. More samples (10–20+) produce more reliable results.

### 4. Train the model

```js
function trainModel() {
  classifier.train((loss) => {
    if (loss === null) {
      // Training complete — loss is null when done
      isClassifying = true;
      classifier.classify(gotResult);
    } else {
      statusText.textContent = `Training loss: ${loss.toFixed(4)}`;
    }
  });
}
```

The callback fires repeatedly during training with the current loss value. When `loss === null`, training is finished.

### 5. Continuous prediction loop

`classifier.classify` is not a streaming API — it classifies one frame and calls the callback once. To keep predicting, call it again inside the callback:

```js
function gotResult(error, results) {
  if (error) return;
  label = results[0].label;
  confidence = results[0].confidence;

  if (isClassifying) {
    classifier.classify(gotResult); // restart the loop
  }
}
```

### 6. Draw the prediction on the canvas

The canvas tints the video with the class colour and shows the label and confidence at the bottom:

```js
function draw() {
  image(video, 0, 0, width, height);
  if (label !== "-") {
    const tintColor = label === "A" ? [95, 110, 232] : [224, 94, 141];
    fill(...tintColor, 70);
    rect(0, 0, width, height); // semi-transparent colour wash
  }
  // text overlay ...
}
```

### 7. Reset

Resetting re-creates the classifier from the feature extractor, discarding all samples and stopping the prediction loop:

```js
function resetAll() {
  countA = 0; countB = 0;
  isClassifying = false;
  classifier = featureExtractor.classification(video); // fresh classifier
}
```

---

## Core ml5 API used

| Call | What it does |
|---|---|
| `ml5.featureExtractor("MobileNet", callback)` | Loads MobileNet as a feature extractor |
| `featureExtractor.classification(video)` | Creates a trainable classifier on top of the extractor |
| `classifier.addImage(label)` | Captures the current video frame as a training sample |
| `classifier.train(callback)` | Trains the model; callback fires with loss each epoch, `null` when done |
| `classifier.classify(callback)` | Classifies one frame; callback receives `results[0].label` and `.confidence` |

---

## Common pitfalls

- **Wrong ml5 version** — `featureExtractor` does not exist in ml5 v1.x. Keep `ml5@0.12.2`.
- **Training with too few samples** — you need examples from multiple angles and lighting conditions for reliable results. Aim for 15+ per class.
- **Camera not ready** — if `featureExtractor.classification(video)` is called before the video element is streaming, `addImage` may capture a blank frame. The model ready callback fires after MobileNet loads, which is usually enough time for the camera to start.
