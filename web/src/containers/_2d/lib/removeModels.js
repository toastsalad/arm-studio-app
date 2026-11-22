// Taking drawings off the canvas. Shared by the pen and laser sections, which had the same eight lines twice.
//
// Two things go wrong here if it is written naively, and both look like "Clear does nothing":
//
//   * the drawing is freed before it is taken out of the scene. dispose() unregisters its preview listener
//     first, and that reaches the socket; with no socket client it throws, so nothing was removed and the
//     drawing stayed on the canvas.
//   * one drawing that throws while being freed stops the loop, leaving the rest in place.
//
// So: out of the scene first, then freed, one failure at a time. A drawing that fails to free leaks some buffers
// until the page is reloaded, which is worth less than a button that works.

/** Free one drawing without letting it stop a removal. */
export const disposeModel = (model) => {
    if (!model || typeof model.dispose !== 'function') return;
    try {
        model.dispose();
    } catch (error) {
        console.error('could not dispose a drawing:', error);
    }
};

/**
 * Take every drawing out of the scene and free it, whatever its type.
 *
 * The child list is copied first: removing them one at a time mutates the array being walked.
 */
export const removeAllModels = (group) => {
    const models = group && Array.isArray(group.children) ? group.children.slice() : [];
    if (models.length && typeof group.remove === 'function') group.remove(...models);
    models.forEach(disposeModel);
    return models.length;
};

/** Take one drawing out of the scene and free it. False when there was nothing to remove. */
export const removeModel = (group, model) => {
    if (!model) return false;
    if (group && typeof group.remove === 'function') group.remove(model);
    disposeModel(model);
    return true;
};
