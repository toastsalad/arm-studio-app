import * as THREE from 'three';

// A marker that follows the running job.  It is deliberately separate from the
// model/toolpath objects, so changing the loaded artwork does not move it.
// depthTest is off so the marker stays visible through the plate and the model.
class JobPointer {
    constructor(options = {}) {
        const {color = 0xff3b30, radius = 1.5} = options;
        const group = new THREE.Group();
        group.name = 'JobPointer';

        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 20, 16),
            new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.95,
                depthTest: false,
                depthWrite: false,
            })
        );
        sphere.renderOrder = 1000;
        group.add(sphere);

        return group;
    }
}

export default JobPointer;
