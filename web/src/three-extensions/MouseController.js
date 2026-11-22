import * as THREE from 'three';
import ThreeUtils from "./ThreeUtils";

const ACTIONS = {
    NONE: 0,

    PAN_OBJECT: 1,
    PAN_CAMERA: 2,
    ROTATE_CAMERA: 3,

    SCALE_OBJECT_X: 4,
    SCALE_OBJECT_Y: 5,
    SCALE_OBJECT_Z: 6,
    SCALE_OBJECT_X_Y: 7,
    SCALE_OBJECT_X_Y_Z: 8,

    ROTATE_OBJECT_X: 9,
    ROTATE_OBJECT_Y: 10,
    ROTATE_OBJECT_Z: 11,
}

class MouseController extends THREE.EventDispatcher {
    constructor(camera, domElement, group, objects, recursiveDetect = false) {
        super();
        this.camera = camera;
        this.domElement = domElement;
        this.group = group;
        this.objects = objects;
        this.recursiveDetect = recursiveDetect;
        this.raycaster = new THREE.Raycaster();

        this.panning = false;

        this.selectedObject = null;
        this.action = ACTIONS.NONE;
        this.anchorPosition = null;

        this.startWorldPosition = new THREE.Vector3();
        this.endWordPosition = new THREE.Vector3();
        this.deltaWordPosition = new THREE.Vector3();
        this.addListeners();
    }


    addListeners() {
        this.domElement.addEventListener('mousedown', this.onMouseDown);
        this.domElement.addEventListener('mousemove', this.onMouseMove);
        this.domElement.addEventListener('mouseup', this.onMouseUp);
        this.domElement.addEventListener('contextmenu', this.onContextMenu);
        this.domElement.addEventListener('mousewheel', this.onMouseWheel);
    }

    removeListeners() {
        this.domElement.removeEventListener('mousedown', this.onMouseDown);
        this.domElement.removeEventListener('mousemove', this.onMouseMove);
        this.domElement.removeEventListener('mouseup', this.onMouseUp);
        this.domElement.removeEventListener('contextmenu', this.onContextMenu);
        this.domElement.removeEventListener('mousewheel', this.onMouseWheel);
    }

    select(selectedObject) {
        this.selectedObject = selectedObject;
    }

    dispose() {
        this.removeListeners();
    }

    onMouseDown = (event) => {
        event.preventDefault();
        this.startWorldPosition.copy(ThreeUtils.getEventWorldPosition(event, this.domElement, this.camera));
        if (event.button === THREE.MOUSE.LEFT) {
            if (this.handleObjectSelection(event)) {
                this.handleObjectActionStart(event);
            } else {
                // Dragging empty space pans the view (was previously a no-op).
                this.action = ACTIONS.PAN_CAMERA;
            }

        } else if (event.button === THREE.MOUSE.RIGHT) {
            this.action = ACTIONS.PAN_CAMERA;
        }
    };

    onMouseMove = (event) => {
        event.preventDefault();

        this.handleMouseCursor(event);

        if (this.action === ACTIONS.NONE)
            return;

        switch (this.action) {
            case  ACTIONS.PAN_OBJECT :
                this.handlePanObject(event);
                break;
            case  ACTIONS.PAN_CAMERA :
                this.handlePanCamera(event);
                break;
            case  ACTIONS.ROTATE_CAMERA :
                break;
            case  ACTIONS.SCALE_OBJECT_X :
                break;
            case  ACTIONS.SCALE_OBJECT_Y :
                break;
            case  ACTIONS.SCALE_OBJECT_Z :
                break;
            case  ACTIONS.SCALE_OBJECT_X_Y :
                break;
            case  ACTIONS.SCALE_OBJECT_X_Y_Z :
                break;
            case  ACTIONS.ROTATE_OBJECT_X :
                break;
            case  ACTIONS.ROTATE_OBJECT_Y :
                break;
            case  ACTIONS.ROTATE_OBJECT_Z :
                break;
        }
    }

    onMouseUp = (event) => {
        this.onMouseMove(event);
        if (this.action === ACTIONS.PAN_OBJECT) {
            this.dispatchEvent({type: 'pan_object_end', object: this.selectedObject});
        }
        this.action = ACTIONS.NONE;
    }

    onContextMenu = (event) => {
        event.preventDefault();
    }

    onMouseWheel = (event) => {
        event.preventDefault();
        const delta = 10;
        let zoomZ = this.camera.position.z;
        if (event.wheelDelta) {
            if (event.wheelDelta > 0) {
                zoomZ -= delta;
            }
            if (event.wheelDelta < 0) {
                zoomZ += delta;
            }
        } else if (event.detail) {
            if (event.detail > 0) {
                zoomZ -= delta;
            }
            if (event.detail < 0) {
                zoomZ += delta;
            }
        }
        if (zoomZ <= 500 && zoomZ >= 30) { // clamp zoom
            this.camera.position.z = zoomZ;
            this.camera.updateProjectionMatrix();
        }
    };

    handleMouseCursor(event) {
        this.raycaster.setFromCamera(ThreeUtils.getMouseXY(event, this.domElement), this.camera);
        const intersects = this.raycaster.intersectObjects(this.objects, true);
        this.domElement.style.cursor = (intersects.length > 0 || this.action !== ACTIONS.NONE) ? 'move' : 'auto';
    }

    // Whether any object was selected.
    handleObjectSelection(event) {
        this.raycaster.setFromCamera(ThreeUtils.getMouseXY(event, this.domElement), this.camera);
        const intersects = this.raycaster.intersectObjects(this.objects, true);
        if (intersects.length > 0) {
            this.dispatchEvent({type: 'detected', object: intersects[0].object});
            return true;
        }
        return false;
    }

    handleObjectActionStart(event) {
        this.startWorldPosition.copy(ThreeUtils.getEventWorldPosition(event, this.domElement, this.camera));
        this.action = ACTIONS.PAN_OBJECT;
    }

    handlePanObject(event) {
        if (!this.selectedObject) return;
        this.endWordPosition.copy(ThreeUtils.getEventWorldPosition(event, this.domElement, this.camera));
        this.deltaWordPosition.subVectors(this.endWordPosition, this.startWorldPosition);
        const targetWordPosition = ThreeUtils.getObjectWorldPosition(this.selectedObject).add(this.deltaWordPosition);
        ThreeUtils.setObjectWorldPosition(this.selectedObject, targetWordPosition);
        this.startWorldPosition.copy(this.endWordPosition);
        this.dispatchEvent({type: 'panning', object: this.selectedObject});
    }

    handlePanCamera(event) {
        this.endWordPosition.copy(ThreeUtils.getEventWorldPosition(event, this.domElement, this.camera));
        this.deltaWordPosition.subVectors(this.endWordPosition, this.startWorldPosition);
        this.group.position.add(new THREE.Vector3(this.deltaWordPosition.x, this.deltaWordPosition.y));
        this.startWorldPosition.copy(this.endWordPosition);
    }
}


export default MouseController;
