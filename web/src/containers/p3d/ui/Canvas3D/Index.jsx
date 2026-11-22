import React from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import PrintableCube from './PrintableCube.jsx';
import {connect} from 'react-redux';
import IntersectDetector from "../../../../three-extensions/IntersectDetector";
import {actions as p3dModelActions} from "../../../../reducers/p3dModel";
import PrintablePlate from "./PrintablePlate";
import JobPointer from '../../../../three-extensions/JobPointer';
import {uploadFile} from "../../../../api";
import {onDragOverFile, getDroppedFile} from "../../../../utils/fileDrop";
import {canvasPalette, lerpColour} from "../../../../utils/canvasPalette";
import {THEME_TRANSITION_MS, prefersReducedMotion} from "../../../../utils/theme";

class Index extends React.Component {
    constructor(props) {
        super(props);

        this.node = React.createRef();

        // three
        this.camera = null;
        this.renderer = null;
        this.scene = null;
        this.group = null;

        this.modelGroup = null; // parent of all Model3D
        this.gcodeGroup = null; // parent of the gcode Object3D

        this.controls = null; // orbits/pans/zooms the camera around the view target

        this.size = new THREE.Vector3(450, 260, 300)
        this.printableArea = new PrintablePlate(new THREE.Vector2(this.size.x, this.size.y), this.props.workHeight);
        this.printableArea.rotation.x = Math.PI / 2;

        this.jobPointer = null;
        this.jobTarget = new THREE.Vector3();
        this._jobLastFrame = 0;
    }

    state = {};

    componentDidMount() {
        this.setupThree();
        this.setupIntersectDetector();
        this.setupControls();

        this.props.setRendererParent4model(this.modelGroup);
        this.props.setRendererParent4gcode(this.gcodeGroup);

        this.animate();
        this.group.add(this.printableArea);
        this.setupJobPointer();
        window.addEventListener('resize', this.resizeWindow, false);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.jobTracker !== this.props.jobTracker) {
            this.updateJobPointer(this.props.jobTracker);
        }
    }

    setupJobPointer = () => {
        if (this.jobPointer) this.group.remove(this.jobPointer);
        this.jobPointer = new JobPointer({color: 0xff3b30, radius: 3.0});
        this.jobPointer.visible = false;
        this.group.add(this.jobPointer);
        this._jobLastFrame = performance.now();
        this._jobHasTarget = false;
        this.updateJobPointer(this.props.jobTracker);
    };

    updateJobPointer = (tracker) => {
        if (!this.jobPointer) return;
        const position = tracker && tracker.position;
        const active = !!(tracker && tracker.active && position);
        this.jobPointer.visible = active;
        if (active) {
            // Same axis mapping the G-code preview uses: X, Z, -Y.
            this.jobTarget.set(position.x, position.z, -position.y);
            this._jobLerpTau = tracker.positionSource === 'bridge' ? 0.45 : 0.12;
            if (!this._jobHasTarget) {
                this.jobPointer.position.copy(this.jobTarget);
                this._jobHasTarget = true;
            }
        }
    };

    UNSAFE_componentWillReceiveProps(nextProps) {
        if (this.props.theme !== nextProps.theme) {
            this.applyTheme();
        }

        if (this.props.tap !== nextProps.tap) {
            this.resizeWindow();
        }
    }

    /**
     * The bed, the work area and the models fix their colours when they are built, so a theme
     * change rebuilds the bed here and lets each model repaint itself. Rebuilding in place keeps
     * whatever is on the bed; setupThree would leave the models outside the new scene.
     *
     * theme.css cannot reach inside the canvas, so the background is stepped here over the same
     * time the rest of the app takes, and the bed is rebuilt once it has landed rather than part
     * way through. This scene renders every frame, so the steps need no waking.
     */
    applyTheme = () => {
        if (!this.renderer) return;
        const to = canvasPalette().clear;
        const from = this.renderer.getClearColor(new THREE.Color()).getHex();

        if (prefersReducedMotion()) {
            this.renderer.setClearColor(new THREE.Color(to), 1);
            this.rebuildForTheme();
            return;
        }

        const start = Date.now();
        const step = () => {
            const t = Math.min((Date.now() - start) / THEME_TRANSITION_MS, 1);
            if (this.renderer) this.renderer.setClearColor(new THREE.Color(lerpColour(from, to, t)), 1);
            if (t < 1) {
                this._themeFrame = requestAnimationFrame(step);
            } else {
                this._themeFrame = null;
                this.rebuildForTheme();
            }
        };
        this._themeFrame = requestAnimationFrame(step);
    };

    rebuildForTheme = () => {
        this.group.remove(this.printableArea);
        this.printableArea = new PrintablePlate(new THREE.Vector2(this.size.x, this.size.y), this.props.workHeight);
        this.printableArea.rotation.x = Math.PI / 2;
        this.group.add(this.printableArea);

        for (const model of this.modelGroup.children) {
            if (model.applyCanvasPalette) model.applyCanvasPalette();
        }
    };

    componentWillUnmount() {
        window.removeEventListener('resize', this.resizeWindow, false);
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        if (this._themeFrame) cancelAnimationFrame(this._themeFrame);
        if (this.renderer) {
            this.renderer.domElement.removeEventListener('wheel', this.onWheel);
            this.renderer.dispose();
            this.renderer = null;
        }
        if (this.controls) {
            this.controls.removeEventListener('change', this.updateCameraDependents);
            this.controls.dispose();
            this.controls = null;
        }
        if (this.intersectDetector) {
            this.intersectDetector.dispose();
            this.intersectDetector = null;
        }
    }

    setupIntersectDetector() {
        this.intersectDetector = new IntersectDetector(
            this.camera,
            this.renderer.domElement,
            this.modelGroup.children,
            false
        );
        this.intersectDetector.addEventListener(
            'detected',
            (event) => {
                const model = event.object;
                this.props.selectModel(model);
            }
        );
    }

    setupControls() {
        // Orbit the camera around a target instead of transforming the scene group, which leaked
        // the view transform into the exported STL.
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 0, 0);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.12;
        // minDistance keeps the view from flipping once the camera would pass the pivot.
        this.controls.minDistance = 2;
        this.controls.maxDistance = Infinity;
        this.controls.panSpeed = 2;
        // The wheel is handled in onWheel: OrbitControls' dolly shrinks the distance by a
        // fraction of itself, so zooming crawls as the camera nears its target.
        this.controls.enableZoom = false;
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
        };
        this.controls.addEventListener('change', this.updateCameraDependents);
        this.renderer.domElement.addEventListener('wheel', this.onWheel, {passive: false});
        this.controls.update();
        this.updateCameraDependents();
    }

    zoomRatio = 0.1;
    zoomMinStep = 10;
    panSpeed = 2;
    panFloorDistance = 200; // mm, below which panning stops slowing down

    onWheel = (event) => {
        event.preventDefault();
        const target = this.controls.target;
        const toTarget = new THREE.Vector3().subVectors(target, this.camera.position);
        const distance = toTarget.length();
        if (distance < 1e-6) return;
        const direction = toTarget.divideScalar(distance);
        const step = Math.max(this.zoomMinStep, distance * this.zoomRatio);
        if (event.deltaY < 0) {
            this.camera.position.addScaledVector(direction, step);
            // Carry the pivot along while it stays comfortably ahead, so zooming never stalls
            // and the direction of travel never reverses (which is what flipped the view).
            const ahead = new THREE.Vector3().subVectors(target, this.camera.position).dot(direction);
            if (ahead < this.controls.minDistance) {
                this.controls.target.copy(this.camera.position)
                    .addScaledVector(direction, this.controls.minDistance);
            }
        } else {
            this.camera.position.addScaledVector(direction, -step);
        }
        this.controls.update();
    };

    updateCameraDependents = () => {
        const distance = Math.max(
            this.controls.minDistance,
            this.camera.position.distanceTo(this.controls.target)
        );
        this.camera.near = Math.max(0.05, distance / 1000);
        this.camera.far = Math.max(2000, distance * 10);
        this.camera.updateProjectionMatrix();
        // OrbitControls scales panning by the distance to the target, so floor it to keep panning
        // responsive once the camera is close.
        this.controls.panSpeed = this.panSpeed * Math.max(1, this.panFloorDistance / distance);
    };

    resizeWindow = () => {
        const width = this.getVisibleWidth();
        const height = this.getVisibleHeight();
        if (width * height !== 0) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }
    };

    onDrop = async (event) => {
        const file = getDroppedFile(event, ['.stl']);
        if (!file) return;
        const {url} = await uploadFile(file);
        this.props.loadModel(url);
    };

    // PrintableCube edge length = size, floor at position.y = 0, camera facing the cube.
    setupThree() {
        const width = this.getVisibleWidth();
        const height = this.getVisibleHeight();

        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
        this.camera.position.copy(new THREE.Vector3(0, 150, 500));
        this.camera.lookAt(new THREE.Vector3(0, 150, 0));

        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.setClearColor(new THREE.Color(canvasPalette().clear), 1);
        this.renderer.setSize(width, height);

        this.scene = new THREE.Scene();
        this.scene.add(this.camera);
        this.scene.add(new THREE.HemisphereLight(0x000000, 0xe0e0e0));

        this.group = new THREE.Group();
        this.group.position.copy(new THREE.Vector3(0, 0, 0));

        this.modelGroup = new THREE.Group();
        this.gcodeGroup = new THREE.Group();

        this.group.add(this.modelGroup);
        this.group.add(this.gcodeGroup);
        this.scene.add(this.group);

        this.node.current.appendChild(this.renderer.domElement);
    }

    animate = () => {
        if (!this.renderer) return;
        this.animationFrameId = requestAnimationFrame(this.animate);
        if (this.jobPointer && this.jobPointer.visible) {
            const now = performance.now();
            const dt = Math.min((now - this._jobLastFrame) / 1000, 0.1);
            this._jobLastFrame = now;
            const k = 1 - Math.exp(-dt / (this._jobLerpTau || 0.12));
            this.jobPointer.position.lerp(this.jobTarget, k);
        }
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    };

    getVisibleWidth() {
        return this.node.current.parentElement.clientWidth;
    }

    getVisibleHeight() {
        return this.node.current.parentElement.clientHeight;
    }

    render() {
        const {workHeight} = this.props
        if (this.workHeight !== workHeight) {
            if (this.printableArea)
                this.printableArea.setUpWorkArea(workHeight)
            this.workHeight = workHeight
        }
        return (
            <div
                ref={this.node}
                onDragOver={onDragOverFile}
                onDrop={this.onDrop}
            />
        )
    }
}

const mapStateToProps = (state) => {
    const {tap} = state.taps;
    const {workHeightP3d} = state.persistentData

    return {
        workHeight: workHeightP3d,
        tap,
        theme: state.theme.resolved,
        jobTracker: state.jobTracker
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setRendererParent4model: (parent) => dispatch(p3dModelActions.setRendererParent4model(parent)),
        setRendererParent4gcode: (parent) => dispatch(p3dModelActions.setRendererParent4gcode(parent)),
        selectModel: (model) => dispatch(p3dModelActions.selectModel(model)),
        loadModel: (url) => dispatch(p3dModelActions.loadModel(url)),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Index);
