

/**
 * Free the GPU memory behind an object and everything under it.
 *
 * Removing an object from a scene does not free its buffers. The 2D canvas replaces a plane geometry on every
 * width, height and rotation change -- that is every tick of a slider drag -- builds a new outline on every
 * selection or resize, and rebuilds the whole toolpath on every preview and every travel-line toggle. Each of
 * those left the old buffer sets allocated until the WebGL context ran out.
 *
 * Textures are deliberately left alone: a texture can be shared between objects, and the owner that created it
 * is the only one that knows when it is safe to drop. Model2DBase.dispose() frees the image texture it made.
 */
const disposeMaterial = (material) => {
    if (!material) return;
    // Materials can carry textures and uniforms that outlive this call; only the material itself is ours.
    if (material.dispose) material.dispose();
};

export const disposeObject3d = (object) => {
    if (!object) return;
    object.traverse((child) => {
        if (child.geometry && child.geometry.dispose) child.geometry.dispose();
        if (Array.isArray(child.material)) {
            child.material.forEach(disposeMaterial);
        } else {
            disposeMaterial(child.material);
        }
    });
};

/**
 * Replace a mesh's geometry, freeing the one it had.
 *
 * Assigning mesh.geometry directly is the usual way to do this and the usual way to leak, because the previous
 * geometry stays on the GPU with nothing left pointing at it.
 */
export const replaceGeometry = (mesh, geometry) => {
    if (!mesh) return geometry;
    const previous = mesh.geometry;
    mesh.geometry = geometry;
    if (previous && previous !== geometry && previous.dispose) previous.dispose();
    return geometry;
};

