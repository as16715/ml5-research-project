# Advanced Image Classification - Scavenger Hunt

A timed, gamified twist on the Easy "Label Reactor" project. The same ml5 `imageClassifier` (MobileNet) is reused, but instead of just reacting to whatever the camera sees, the player is asked to **find a specific household object** and hold it up before the round timer runs out.

## How to play
1. Open `index.html` in a browser.
2. Allow camera access and wait for "Start Game" to appear.
3. A target item appears on screen (e.g. *Find: Computer Mouse*).
4. Grab the item from around your house and hold it clearly in front of the camera.
5. Score points before the **20-second** round timer runs out. Faster catches = more points.
6. The game ends after **2 minutes**. Try to beat your best score (saved locally).

## What this teaches
- ml5 `imageClassifier` with MobileNet (same model as the Easy project)
- Continuous classification of webcam frames in a game loop
- Mapping ImageNet-style labels to friendly object categories using keyword matching
- Building a small game state machine in JS (`idle` -> `playing` -> `over`)
- Debouncing detections with consecutive-frame confirmation to reduce false positives
- Persisting a high score with `localStorage`

## Item pool
Common household items the game asks for:
Bottle, Computer Mouse, Glasses, Cup or Mug, Book, Banana, Keyboard, Cell Phone, Remote Control, Wristwatch, Wallet or Purse, Scissors, Headphones, Pen or Pencil, Apple, Spoon.

Each item lists the MobileNet keywords it accepts inside `ITEMS` in `index.html`.

## Tunable knobs (top of the script in `index.html`)
- `GAME_DURATION_MS` - total game length (default 2 minutes).
- `ROUND_DURATION_MS` - time given per target (default 20 seconds).
- `HIT_CONFIDENCE` - minimum classifier confidence to count as a sighting.
- `HIT_FRAMES` - consecutive sightings needed before a hit registers (debounce).

## Creative tweak ideas
- Add difficulty modes that shrink the round timer or raise the confidence threshold.
- Award streak bonuses for back-to-back hits without misses.
- Add a "wrong item!" penalty if the classifier confidently sees a *different* item from the pool.
- Replace the chip-style HUD with painted overlays drawn directly to the p5 canvas.
- Add sound effects on hit / miss / game over using the Web Audio API.
- Let the player customise the item pool from the start screen.
