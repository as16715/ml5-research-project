# Advanced Pose Estimation - Bunny Puppet Theater

Step in front of your camera and **become the bunny**. ml5 `bodyPose` (MoveNet) tracks your skeleton in real time and pins cartoon bunny pieces &mdash; ears, nose, whiskers, blush, and big paws &mdash; directly onto your body in the live video feed. Behind it all, a theatrical stage frames the scene with red velvet curtains, a golden valance, footlights, and floating dust motes.

## How it works
- The **live camera feed** is the backdrop &mdash; you can see yourself the whole time.
- A subtle vignette dims the edges so the center reads as "lit center stage".
- Cartoon **bunny pieces** are drawn on top of you, anchored to pose keypoints:
  - **Ears** anchor to the top of your head (computed from the nose keypoint and head width).
  - **Heart-shaped pink nose**, **whiskers**, **blush cheeks**, and a tiny mouth anchor to your face.
  - **Big fluffy paws** anchor to each wrist, oriented along your forearm direction.
- **Curtains, valance, and footlights** are then drawn on top to frame the performance.

## The signature interaction: claws
Your wrist height drives the bunny's claws.

- Wrist **at or below your shoulder** &rarr; soft pink toe pads, claws fully sheathed.
- Wrist **rising above your shoulder** &rarr; claws gradually extend out of each toe.
- Wrist **well above your head** &rarr; claws fully out.

The HUD in the bottom-right shows a live "Claws" meter so you can see how far each pose pushes the extension.

## How to play
1. Open `index.html` in a browser.
2. Allow camera access and wait for "Model ready" to appear.
3. Stand back so your **head and shoulders** are clearly in frame.
4. Look at the camera so the ears lock onto your head.
5. Raise and lower your hands to play with the claws.

## What this teaches
- ml5 `bodyPose` keypoint tracking with MoveNet
- Compositing: live `<video>` (drawn into p5 via `image(video, ...)`) underneath custom canvas overlays
- Anchoring vector graphics to keypoints with proper rotation (paws rotate to match each forearm)
- Using bezier curves to draw cartoon shapes (ears, nose, palm pad)
- Driving an animation parameter from a body relationship (wrist-y vs shoulder-y) and easing it into a visual (claw extension)
- Idle "life" animation &mdash; the nose twitches on a slow sine + occasional sniff so the bunny feels alive even when you stand still

## Files
- `index.html` &mdash; layout, stage panel, p5/ml5 boot, draw loop, HUD wiring.
- `bunny.js` &mdash; the `Stage` class (curtains, valance, footlights, dust, vignette), bunny part renderers (`drawBunnyEars`, `drawBunnyFace`, `drawBunnyPaws`), and the `clawAmount` helper.
- `README.md` &mdash; this file.

## Tunable knobs (top of `bunny.js`)
- `COLORS` &mdash; swap the palette to make a chocolate bunny (browns), shadow bunny (grays), or pastel bunny.
- `OUTLINE_W` &mdash; cartoon outline thickness.
- Inside `clawAmount` &mdash; change the `0.7` divisor to make claws extend more eagerly or more reluctantly.
- Inside `Stage.drawCurtains` &mdash; change the `sideW` factor to widen or narrow the stage opening.

## Creative tweak ideas
- Add a **tail puff** that follows hip movement (when the user turns slightly).
- Trigger a **hop animation** that bobs the ears when both knees rise quickly.
- Play a soft **"sniff" sound** synced to the nose twitch using the Web Audio API.
- Add a fur-color picker to the side panel (snow / chocolate / shadow palettes).
- Save a screenshot as a "publicity still" using `canvas.toBlob()`.
- Detect when both wrists are raised and extended for a beat &mdash; trigger a sparkle particle burst around the paws.

## Notes
- `bodyPose` is loaded with `{ flipped: true }` so the puppet mirrors your real-world movement intuitively (your right hand drives the bunny's right paw on screen).
- Head-width is estimated from ear keypoints when available, then eye distance, then shoulder distance &mdash; this keeps the ears stable even if one ear keypoint disappears off the side of the frame.
