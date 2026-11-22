/**
 * The geometry behind dragging a drawing's resize/rotate handles.
 *
 * Kept out of the canvas component so it can be tested: these functions hold the
 * invariants (proportional resize, a minimum width, a rotation that wraps into
 * [-180, 180) and then respects the setting limits) while the component only wires
 * pointer events and schedules renders.
 */

/** Pointer angle around `center`, in radians. */
export const pointerAngle = (pointer, center) =>
    Math.atan2(pointer.y - center.y, pointer.x - center.x);

const changedEnough = (previous, next) => Math.abs(next - previous) >= 0.5;
export const beginResize = (pointerDistance, width) => ({
    // A pointer exactly on the centre would divide by zero on the first move.
    startDist: Math.max(pointerDistance, 0.001),
    startWidth: width,
    lastWidth: width,
});

/** Width for the current pointer distance: proportional to the drag, never under `minWidth`. */
export const resizeWidth = (resize, pointerDistance, minWidth) =>
    Math.max(resize.startWidth * (pointerDistance / resize.startDist), minWidth);

export const beginRotate = (angle, rotation) => ({
    startAngle: angle,
    startRotation: rotation,
    lastRotation: rotation,
});

/** Rotation for the current pointer angle: follows the drag, wraps into [-180, 180), then clamps. */
export const rotateRotation = (rotate, angle, min, max) => {
    const delta = angle - rotate.startAngle;
    const rotation = rotate.startRotation + delta * 180 / Math.PI;
    const wrapped = ((rotation + 180) % 360 + 360) % 360 - 180;
    return Math.min(Math.max(wrapped, min), max);
};

/** True when a drag has moved far enough to be worth a state update and a render. */
export const moved = changedEnough;