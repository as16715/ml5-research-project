# Advanced Hand Pose — Fruit Slice Trail

## What this teaches
- Using ml5 `handPose` to track fingertips with a live camera feed
- Turning finger velocity into a game interaction (slice threshold)
- Spawning animated sprites with gravity and collisions
- Using canvas clipping to simulate sliced fruit halves

## Run
1. Open `index.html` in a browser.
2. Allow camera access.
3. Swipe your index finger quickly to slice fruits.

## Notes
- Fruit images live in `Images/` and are loaded dynamically.
- To add more fruit, drop a transparent PNG/JPG into `Images/` and add the filename to `FRUIT_FILES` in `index.html`.

## Creative tweak ideas
- Add a combo system for slicing multiple fruits in one swipe.
- Spawn special fruit that grant bonus points or slow time.
- Add juicy splash particles at the slice position.
