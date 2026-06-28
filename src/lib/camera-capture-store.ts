// Tiny in-memory handoff between /camera and /upload routes.
// Keeps the captured File alive across a single client-side navigation.
let pending: File | null = null;

export function setPendingCapture(file: File | null) {
  pending = file;
}

export function takePendingCapture(): File | null {
  const f = pending;
  pending = null;
  return f;
}
