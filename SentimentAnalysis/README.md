# Sentiment Analysis — Easy: Mood Meter

Uses ml5 `sentiment` (MovieReviews model) to predict how positive or negative a piece of text is. The result drives a colour-gradient progress bar from red (negative) to green (positive). An optional bias-correction layer adjusts for the model's known optimism on short phrases.

---

## Dependencies

```html
<script src="https://unpkg.com/ml5@1/dist/ml5.min.js"></script>
```

No p5.js — this project is plain HTML/CSS/JS.

---

## How to run

1. Open `index.html` in any browser (no server required — no camera or mic needed).
2. Type or edit text in the textarea.
3. Click **Analyze** or press **Enter** to score the text.
4. Optionally enable **Use bias correction** to see the adjusted score.

---

## Key variables

| Variable | Purpose |
|---|---|
| `sentiment` | ml5 sentiment model instance |
| `modelReady` | `true` once the model resolves |
| `modelLoading` | `true` while the async load is in progress |
| `modelFailed` | `true` if load throws or times out — triggers fallback scorer |

---

## Step-by-step implementation

### 1. Load the model asynchronously

`ml5.sentiment()` returns a promise-like object. Wrapping it in `Promise.resolve()` lets you `await` it in an async function:

```js
async function initSentimentModel() {
  try {
    const loaded = await Promise.resolve(ml5.sentiment("movieReviews"));
    sentiment = loaded;
    modelReady = true;
  } catch (err) {
    modelFailed = true;
  }
}
```

`"movieReviews"` is the only supported model name in ml5 v1. It was trained on IMDB reviews and scores text from 0 (negative) to 1 (positive).

### 2. 12-second timeout fallback

CDN loads can stall silently. A `setTimeout` flags model failure so the UI never stays stuck on "loading":

```js
setTimeout(() => {
  if (modelLoading && !modelReady) {
    modelLoading = false;
    modelFailed = true;
    resultText.textContent = "Model load timed out. Using fallback scoring.";
  }
}, 12000);
```

### 3. Run a prediction

`sentiment.predict(text)` returns an object with a `confidence` property (0–1):

```js
const prediction = await Promise.resolve(sentiment.predict(text));
rawScore = prediction.confidence;
```

`await Promise.resolve(...)` is used defensively — in ml5 v1 the return may be a raw value or a thenable depending on the build.

### 4. Fallback keyword scorer

When the model fails or times out, a simple keyword counter takes over so the page stays usable:

```js
function fallbackScore(text) {
  const positiveWords = ["good", "great", "love", "happy", "awesome", "amazing", ...];
  const negativeWords = ["bad", "sad", "hate", "awful", "terrible", ...];
  const tokens = tokenize(text);
  let score = 0;
  for (const token of tokens) {
    if (positiveWords.includes(token)) score += 1;
    if (negativeWords.includes(token)) score -= 1;
  }
  // Normalize: 0.5 = neutral, bounded to [0, 1]
  const normalized = 0.5 + score / Math.max(tokens.length * 2, 6);
  return Math.max(0, Math.min(1, normalized));
}
```

`tokenize(text)` extracts lowercase alphabetic tokens with `text.toLowerCase().match(/[a-z']+/g)`.

### 5. Bias correction (optional)

The MovieReviews model skews optimistic — neutral sentences often score ~0.62 instead of 0.5. `calibrateModelScore` re-centres and fine-tunes the output:

```js
function calibrateModelScore(rawScore, text) {
  const baseline = 0.62;
  const centered = 0.5 + (rawScore - baseline) * 1.35; // shift + stretch
  const lexAdjusted = centered + lexicalShift(text);    // word-level nudge
  const phr = phraseShift(text);                        // phrase-level nudge
  let shifted = lexAdjusted + phr;

  // Hard cap: if a clear negative self-state phrase was found, don't show positive
  if (phr <= -0.25) shifted = Math.min(shifted, 0.45);

  return Math.max(0, Math.min(1, shifted));
}
```

`lexicalShift(text)` applies ±0.12 per strong positive/negative word (capped at ±0.30).

`phraseShift(text)` uses regex patterns to detect first-person emotional statements like `"I feel terrible"` (−0.34) or `"I am happy"` (+0.26).

### 6. Update the meter

After scoring, the fill bar width and result label are updated directly:

```js
const percent = Math.round(score * 100);
fillBar.style.width = `${percent}%`;

let tone = "Neutral";
if (score > 0.58) tone = "Positive";
else if (score < 0.42) tone = "Negative";

resultText.textContent = `Sentiment score: ${percent}% (${tone})`;
```

The bar's gradient (`red → amber → green`) is set in CSS; only the width changes in JS.

### 7. Enter key shortcut

```js
textInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault(); // prevent newline
    runAnalysis();
  }
});
```

`Shift+Enter` still inserts a newline in the textarea.

---

## Core ml5 API used

| Call | What it does |
|---|---|
| `ml5.sentiment("movieReviews")` | Loads the sentiment model |
| `sentiment.predict(text)` | Returns `{confidence: 0–1}` for the input string |

---

## Common pitfalls

- **Score stuck near 0.6 for neutral text** — the MovieReviews model is biased toward positive. Enable bias correction or re-centre manually: `adjustedScore = 0.5 + (raw - 0.62) * factor`.
- **Model never resolves** — `ml5.sentiment()` may not return a standard Promise in some builds. Wrap with `Promise.resolve()` before awaiting to handle both cases.
- **Empty text** — always trim and guard with `if (!text) return` before calling `predict`. An empty string can return an unexpected score.
- **No server required** — unlike camera or mic projects, sentiment analysis is pure text processing and works from `file://` (no HTTP server needed).
