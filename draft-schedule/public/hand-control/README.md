# Browser hand-control assets

These static files let the browser run inference without calling an external
model host. Camera frames and landmarks remain in memory; they are not recorded,
uploaded, persisted, or logged. The microphone is not requested.

- WASM runtime: `@mediapipe/tasks-vision@0.10.32`, copied from the package's `wasm` directory.
- Gesture model: https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task
- MediaPipe project and license: https://github.com/google-ai-edge/mediapipe
- Documentation: https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer/web_js

One Euro filtering and teleport rejection were implemented independently in the
application, with architecture reference to:
https://github.com/CR8C0NT1NUM/mediapipe-hand-cursor

Run focused regression checks from `draft-schedule`:

```sh
node --test tests/cursorMotion.test.js tests/handCommands.test.js tests/handSensitivity.test.js tests/pinchPointer.test.js
npm run build
```
