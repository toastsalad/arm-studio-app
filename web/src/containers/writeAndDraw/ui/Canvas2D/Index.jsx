import React from 'react';
import styles from './styles.css';
import * as THREE from 'three';
import Throbber from '../../../../components/Throbber/Index.jsx';
import PrintablePlate from "./PrintablePlate.js"
import JobPointer from '../../../../three-extensions/JobPointer';
import MouseController from '../../../../three-extensions/MouseController';
import ThreeUtils from '../../../../three-extensions/ThreeUtils';
import {actions as writeAndDrawActions} from "../../../../reducers/writeAndDraw";
import {actions as laserActions} from "../../../../reducers/laser";
import {connect} from 'react-redux';
import {FRONT_END} from "../../../../utils/workAreaUtils";
import { getIsAdvance, degree2radian } from '../../../../utils';
import {onDragOverFile, getDroppedFile} from '../../../../utils/fileDrop'
import {applyTravelToModels} from '../../../_2d/lib/toolPathRenderer';
import {canvasPalette, lerpColour} from '../../../../utils/canvasPalette';
import {THEME_TRANSITION_MS, prefersReducedMotion} from '../../../../utils/theme';
import {settingsNumber, settingField} from '../../../../utils/settings.js';
import {beginResize, beginRotate, moved, pointerAngle, resizeWidth, rotateRotation} from '../../lib/handleDrag';

// Size and inset of the busy marker that sits inside the image's bottom-right corner.
const THROBBER_SIZE = 28;
const THROBBER_INSET = 8;

/**
 * Three.js
 */
class Index extends React.Component {
    constructor(props) {
        super(props);
        this.node = React.createRef();
        this.throbber = React.createRef();
        // Mirrors model.isPreviewing, which lives on the model object rather than in the store, so
        // React only learns about it when the model fires its preview event.
        this.state = {busy: false};

        this.camera = null;
        this.renderer = null;
        this.scene = null;
        this.group = null;
        this.modelGroup = null;

        this.mouseController = null;
        this.printablePlate = null;

        this.jobPointer = null;
        this.jobTarget = new THREE.Vector3();
        this._jobLastFrame = 0;

        this.renderFlag = true
        this.renderTimer = null
    }

    componentDidMount() {
        this.setupThree();
        this.setupMouseController();
        this.props.setRendererParent(this.modelGroup);
        this.setRenderTimer()
        this.animate();
        this.printablePlate = new PrintablePlate(
            new THREE.Vector2(450, 260), 
            this.props.workHeight, 
            this.props.frontEnd,
            this.props.isBasic || false
        );
        this.group.add(this.printablePlate);
        this.setupJobPointer();
        window.addEventListener('resize', this.resizeWindow, false);

        window.addEventListener('click', this.setRenderTimer, false)
        window.addEventListener('keydown', this.setRenderTimer, false)
        window.addEventListener('wheel', this.setRenderTimer, false)
        // Keep rendering while dragging
        window.addEventListener('mousemove', this.setRenderTimer, false)
        this.renderer.domElement.addEventListener('mousedown', this.onCanvasMouseDown, true);
        this.renderer.domElement.addEventListener('mousemove', this.onCanvasMouseMove);
        this.attachModelPreviewListener(this.props.model);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.model !== this.props.model) {
            this.attachModelPreviewListener(this.props.model);
        }
        if (prevProps.modelCount !== this.props.modelCount) {
            // A drawing was added or removed. The scene changed but nothing about it fires an event, and the
            // render loop stops a few seconds after the last change: without this a Clear can leave the last
            // frame on screen, which reads as the button having done nothing.
            this.setRenderTimer();
        }
        if (prevProps.jobTracker !== this.props.jobTracker) {
            this.updateJobPointer(this.props.jobTracker);
        }
        if (prevProps.plotProgress !== this.props.plotProgress) {
            this.updatePlotProgress(this.props.plotProgress);
        }
    }

    /**
     * Paint the plotted part of every drawing red, and the travel already crossed grey.
     *
     * Same shape as updateJobPointer: the reducers publish a number, the canvas hands it to the models,
     * and the render loop is woken because it stops a few seconds after the last change.
     */
    updatePlotProgress = (progress) => {
        if (!progress) return;
        const sent = progress.sent;
        if (!this.group) return;
        for (const model of this.group.children) {
            if (model && typeof model.setPlotProgress === 'function') model.setPlotProgress(sent);
        }
        this.setRenderTimer();
    };

    setupJobPointer = () => {
        if (this.jobPointer) this.group.remove(this.jobPointer);
        this.jobPointer = new JobPointer({color: 0xff3b30, radius: 1.5});
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
            this.jobTarget.set(position.x, position.y, position.z);
            this._jobLerpTau = tracker.positionSource === 'bridge' ? 0.45 : 0.12;
            if (!this._jobHasTarget) {
                this.jobPointer.position.copy(this.jobTarget);
                this._jobHasTarget = true;
            }
            this.setRenderTimer();
        }
    };

    // The toolpath arrives asynchronously; render when it changes the model.
    attachModelPreviewListener = (model) => {
        if (this._previewModel === model) return;
        if (this._previewModel) this._previewModel.removeEventListener('preview', this.onModelPreview);
        this._previewModel = model;
        if (model) model.addEventListener('preview', this.onModelPreview);
        this._throbberRects = null;
        this.setState({busy: !!(model && model.isPreviewing)});
    };

    onModelPreview = () => {
        this.setRenderTimer();
        const model = this.props.model;
        const busy = !!(model && model.isPreviewing);
        if (busy !== this.state.busy) this.setState({busy});
    };

    componentWillUnmount() {
        window.removeEventListener('resize', this.resizeWindow, false);
        window.removeEventListener('click', this.setRenderTimer)
        window.removeEventListener('keydown', this.setRenderTimer)
        window.removeEventListener('wheel', this.setRenderTimer)
        window.removeEventListener('mousemove', this.setRenderTimer)
        if (this.renderer) this.renderer.domElement.removeEventListener('mousedown', this.onCanvasMouseDown, true);
        if (this.renderer) this.renderer.domElement.removeEventListener('mousemove', this.onCanvasMouseMove);
        window.removeEventListener('mousemove', this.onResizeMove);
        window.removeEventListener('mouseup', this.onResizeUp);
        window.removeEventListener('mousemove', this.onRotateMove);
        window.removeEventListener('mouseup', this.onRotateUp);
        if (this.renderTimer) clearTimeout(this.renderTimer);
        if (this._themeFrame) cancelAnimationFrame(this._themeFrame);
        if (this._previewModel) this._previewModel.removeEventListener('preview', this.onModelPreview);
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
    }

    UNSAFE_componentWillReceiveProps(nextProps) {
        // Reload workspace when advance changes
        if (this.props.advance !== nextProps.advance) {
            while(this.node.current.hasChildNodes()) {
                this.node.current.removeChild(this.node.current.firstChild);
            }

            this.setupThree();
            this.setupMouseController();
            this.props.setRendererParent(this.modelGroup);
            this.animate();
            this.printablePlate = new PrintablePlate(
                new THREE.Vector2(450, 260), 
                this.props.workHeight, 
                this.props.frontEnd,
                this.props.isBasic || false
            );
            this.group.add(this.printablePlate);
            this.setupJobPointer();
        }

        if (this.props.theme !== nextProps.theme) {
            this.applyTheme();
        }

        if (this.props.tap !== nextProps.tap) {
            this.resizeWindow();
        }
    }

    setupMouseController() {
        this.mouseController = new MouseController(this.camera, this.renderer.domElement, this.group, this.modelGroup.children);
        this.mouseController.addEventListener(
            'detected',
            (event) => {
                const model = this._modelFor(event.object);
                if (!model) return;
                this.props.selectModel(model);
                this.mouseController.select(model);
            }
        );
        this.mouseController.addEventListener(
            'pan_object_end',
            (event) => {
                const {x, y} = event.object.position;
                this.props.updateTransformation("x", x, false)
                this.props.updateTransformation("y", y, false)
            }
        );
    }

    resizeWindow = () => {
        this.setRenderTimer()
        const width = this.getVisibleWidth();
        const height = this.getVisibleHeight();
        if (width * height !== 0) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }
        this._throbberRects = null;
    };

    setRenderTimer = () => {
        if (this.renderTimer) {
            return
        }


        this.renderFlag = true
        this.renderTimer = setTimeout(() => {
            clearTimeout(this.renderTimer)
            this.renderTimer = null
            this.renderFlag = false
        }, 5000)
    }

    setupThree() {
        // A previous setup (e.g. on the advance toggle) must release its WebGL
        // context before a new renderer is created.
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
        const width = this.getVisibleWidth();
        const height = this.getVisibleHeight();

        this.scene = new THREE.Scene();
        this.group = new THREE.Group();
        this.modelGroup = new THREE.Group();

        // Hierarchy: scene > group > modelGroup > models
        // Raycast target is modelGroup.children
        this.scene.add(this.group);
        this.group.add(this.modelGroup);

        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);

        // View center: 0 in advance mode, else 280
        const y = getIsAdvance() ? 0 : 280

        this.camera.position.copy(new THREE.Vector3(0, y, 150));
        this.camera.lookAt(new THREE.Vector3(0, y, 0));

        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.setClearColor(new THREE.Color(canvasPalette().clear), 1);
        this.renderer.setSize(width, height);

        this.node.current.appendChild(this.renderer.domElement);
    }

    /**
     * The clear colour, the work area and each model's own materials all fix their colours when
     * they are built, so a theme change has to rebuild them. The models are repainted in place
     * rather than by re-running setupThree, which would leave every model outside the new scene.
     *
     * theme.css cannot reach inside the canvas, so the background is stepped here over the same
     * time the rest of the app takes, and the plate and models are rebuilt once it has landed
     * rather than part way through.
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
            this.setRenderTimer();
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
        if (this.printablePlate) {
            this.group.remove(this.printablePlate);
            this.printablePlate = new PrintablePlate(
                new THREE.Vector2(450, 260),
                this.props.workHeight,
                this.props.frontEnd,
                this.props.isBasic || false
            );
            this.group.add(this.printablePlate);
        }

        for (const model of this.modelGroup.children) {
            if (model.applyCanvasPalette) model.applyCanvasPalette();
        }

        this._throbberRects = null;
        this.setRenderTimer();
    };

    animate = () => {
        if (!this.renderer) return;
        this.animationFrameId = requestAnimationFrame(this.animate);
        this.applyTravelVisibility();
        if (this.jobPointer && this.jobPointer.visible) {
            const now = performance.now();
            const dt = Math.min((now - this._jobLastFrame) / 1000, 0.1);
            this._jobLastFrame = now;
            const k = 1 - Math.exp(-dt / (this._jobLerpTau || 0.12));
            this.jobPointer.position.lerp(this.jobTarget, k);
        }
        /**
         * Rendering is not frame-rate sensitive; half rate cuts CPU/GPU load,
         * except while the job pointer is moving.
         */
        (this.renderFlag || (this.jobPointer && this.jobPointer.visible))
            && this.renderer.render(this.scene, this.camera);
        this.updateThrobber();
    };

    /**
     * Make the green pen-up moves visible or invisible, for every drawing on the canvas.
     *
     * The lines stay in the scene and only stop being drawn (see Model2DBase.setTravelVisible), so this costs a
     * traversal of the model list and nothing else. It runs from the render loop when the flag or the selection
     * has moved, and marks the scene dirty so the change is actually painted.
     */
    applyTravelVisibility = () => {
        const show = this.props.showTravel === true;
        if (this._travelShown === show && this._travelModel === this.props.model) return;
        this._travelShown = show;
        this._travelModel = this.props.model;

        const root = this.modelGroup;
        applyTravelToModels(root ? root.children : [], show);
        // The canvas only draws when something marks it dirty, so a change on its own would sit there unseen.
        this.setRenderTimer();
    };

    /**
     * Keep the busy marker pinned inside the bottom-right corner of the image, projected through
     * the camera each frame so it stays attached while the view pans, zooms or the model rotates.
     * The transform is written straight to the DOM node rather than through React state: a setState
     * per frame would re-render the tree 60 times a second. Visibility belongs to the Throbber,
     * which also decides when a slow-enough preview has earned a marker at all.
     */
    updateThrobber = () => {
        const marker = this.throbber.current;
        if (!marker) return;

        const model = this.props.model;
        if (!model || !model.isPreviewing || !model.settings) return;

        // The canvas only moves on resize, so measure it when the marker appears.
        if (!this._throbberRects) {
            const canvas = this.renderer.domElement.getBoundingClientRect();
            const host = this.node.current.getBoundingClientRect();
            this._throbberRects = {
                left: canvas.left - host.left,
                top: canvas.top - host.top,
                width: canvas.width,
                height: canvas.height,
            };
        }
        const rect = this._throbberRects;

        const transformation = model.settings.transformation.children;
        const corner = new THREE.Vector3(
            transformation.width.default_value / 2,
            -transformation.height.default_value / 2,
            0
        ).applyAxisAngle(new THREE.Vector3(0, 0, 1), degree2radian(transformation.rotation.default_value));
        // Don't rely on the renderer having just refreshed the matrices; the render only runs on
        // some frames.
        model.updateMatrixWorld(true);
        model.localToWorld(corner);
        corner.project(this.camera);

        const x = rect.left + (corner.x * 0.5 + 0.5) * rect.width;
        const y = rect.top + (-corner.y * 0.5 + 0.5) * rect.height;

        marker.style.transform =
            `translate(${Math.round(x - THROBBER_SIZE - THROBBER_INSET)}px, ${Math.round(y - THROBBER_SIZE - THROBBER_INSET)}px)`;
    };

    getVisibleWidth() {
        return this.node.current.parentElement.clientWidth;
    }

    getVisibleHeight() {
        return this.node.current.parentElement.clientHeight;
    }

    onCanvasMouseDown = (event) => {
        if (event.button !== 0) return;
        const model = this.props.model;
        if (!model || !model.getHandleWorldPositions) return;
        const handle = this._handleAt(event, model);
        if (!handle) return;
        event.preventDefault();
        event.stopPropagation();
        if (handle === 'rotate') {
            this._startRotate(event, model);
        } else {
            this._startResize(event, model);
        }
    };

    onDrop = (event) => {
        // The pen plots SVG as-is and traces dropped images by centerline; the laser also takes
        // bitmap images through its B&W / greyscale engraving modes.
        const isLaser = this.props.frontEnd === FRONT_END.LASER;
        const extensions = ['.svg', '.bmp', '.gif', '.jpeg', '.jpg', '.png'];
        const file = getDroppedFile(event, extensions);
        if (!file) return;
        const fileType = file.name.toLowerCase().endsWith('.svg')
            ? 'svg'
            : (isLaser ? 'greyscale' : 'trace');
        this.props.addModel(fileType, file);
        // A native drag fires no mouse events, so wake the idle render loop.
        this.setRenderTimer();
    };

    onCanvasMouseMove = (event) => {
        const model = this.props.model;
        if (!model || !model.getHandleWorldPositions) return;
        const handle = this._handleAt(event, model);
        if (!handle) return;
        const cursors = {
            tl: 'nwse-resize', br: 'nwse-resize',
            tr: 'nesw-resize', bl: 'nesw-resize',
            rotate: 'grab',
        };
        this.renderer.domElement.style.cursor = cursors[handle];
    };

    /**
     * The ray reports whichever leaf it hits first, and the rendered toolpath is a Group of lines,
     * so a hit on a stroke hands back the Group rather than its model. Walk up to the direct child
     * of the model group - nothing else in this scene belongs to a model.
     */
    _modelFor = (object) => {
        let node = object;
        while (node && node.parent !== this.modelGroup) node = node.parent;
        return node || null;
    };

    _handleAt(event, model) {
        const positions = model.getHandleWorldPositions();
        if (!positions) return null;
        const rect = this.renderer.domElement.getBoundingClientRect();
        let best = null;
        let bestDist = 14;
        for (const key of Object.keys(positions)) {
            const ndc = positions[key].clone().project(this.camera);
            const sx = rect.left + (ndc.x * 0.5 + 0.5) * rect.width;
            const sy = rect.top + (-ndc.y * 0.5 + 0.5) * rect.height;
            const dist = Math.hypot(sx - event.clientX, sy - event.clientY);
            if (dist < bestDist) { bestDist = dist; best = key; }
        }
        return best;
    }

    _startResize(event, model) {
        const center = model.getCenterWorldPosition();
        const pointer = ThreeUtils.getEventWorldPosition(event, this.renderer.domElement, this.camera);
        this._resize = {
            model,
            ...beginResize(pointer.distanceTo(center),
                settingsNumber(model.settings, 'transformation.width', 0)),
        };
        window.addEventListener('mousemove', this.onResizeMove);
        window.addEventListener('mouseup', this.onResizeUp);
    }

    onResizeMove = (event) => {
        const resize = this._resize;
        if (!resize) return;
        const center = resize.model.getCenterWorldPosition();
        const pointer = ThreeUtils.getEventWorldPosition(event, this.renderer.domElement, this.camera);
        const minWidth = settingField(resize.model.settings, 'transformation.width', 'minimum_value', 0);
        const width = resizeWidth(resize, pointer.distanceTo(center), minWidth);
        if (!moved(resize.lastWidth, width)) return;
        resize.lastWidth = width;
        this.props.updateTransformation('width', width, false);
        this.setRenderTimer();
    };

    onResizeUp = () => {
        const resize = this._resize;
        window.removeEventListener('mousemove', this.onResizeMove);
        window.removeEventListener('mouseup', this.onResizeUp);
        if (!resize) return;
        this._resize = null;
        this.props.updateTransformation('width', resize.lastWidth, true);
    };

    _startRotate(event, model) {
        const center = model.getCenterWorldPosition();
        const pointer = ThreeUtils.getEventWorldPosition(event, this.renderer.domElement, this.camera);
        this._rotate = {
            model,
            ...beginRotate(pointerAngle(pointer, center),
                settingsNumber(model.settings, 'transformation.rotation', 0)),
        };
        window.addEventListener('mousemove', this.onRotateMove);
        window.addEventListener('mouseup', this.onRotateUp);
    }

    onRotateMove = (event) => {
        const rotate = this._rotate;
        if (!rotate) return;
        const center = rotate.model.getCenterWorldPosition();
        const pointer = ThreeUtils.getEventWorldPosition(event, this.renderer.domElement, this.camera);
        const limits = rotate.model.settings;
        const rotation = rotateRotation(rotate, pointerAngle(pointer, center),
            settingField(limits, 'transformation.rotation', 'minimum_value', -180),
            settingField(limits, 'transformation.rotation', 'maximum_value', 180));
        if (!moved(rotate.lastRotation, rotation)) return;
        rotate.lastRotation = rotation;
        this.props.updateTransformation('rotation', rotation, false);
        this.setRenderTimer();
    };

    onRotateUp = () => {
        const rotate = this._rotate;
        window.removeEventListener('mousemove', this.onRotateMove);
        window.removeEventListener('mouseup', this.onRotateUp);
        if (!rotate) return;
        this._rotate = null;
        this.props.updateTransformation('rotation', rotate.lastRotation, true);
    };

    render() {
        const { workHeight } = this.props
        if (this.workHeight !== workHeight) {
            if (this.printablePlate) this.printablePlate.setUpWorkArea(workHeight)
            this.workHeight = workHeight
        }
        return (
            <div style={{position: 'relative', width: '100%', height: '100%'}}>
                <div
                    ref={this.node}
                    onDragOver={onDragOverFile}
                    onDrop={this.onDrop}
                />
                <Throbber
                    nodeRef={this.throbber}
                    visible={this.state.busy}
                    className={styles.throbber}/>
            </div>
        )
    }
}

const Canvas2dPen = connect(
    (state) => {
        const {workHeightPen, advance} = state.persistentData
        const {tap} = state.taps;
        const {model} = state.writeAndDraw;
        return {
            model,
            modelCount: state.writeAndDraw.modelCount,
            tap,
            workHeight: workHeightPen,
            frontEnd: FRONT_END.PEN,
            advance,
            theme: state.theme.resolved,
            jobTracker: state.jobTracker,
            showTravel: state.viewOptions.showTravel
        };
    },
    (dispatch) => {
        return {
            setRendererParent: (modelsParent) => dispatch(writeAndDrawActions.setRendererParent(modelsParent)),
            selectModel: (model) => dispatch(writeAndDrawActions.selectModel(model)),
            updateTransformation: (key, value, preview) => dispatch(writeAndDrawActions.updateTransformation(key, value, preview)),
            addModel: (fileType, file) => dispatch(writeAndDrawActions.addModel(fileType, file)),
        };
    }
)(Index);

const Canvas2dLaser = connect(
    (state) => {
        const {workHeightLaser, advance} = state.persistentData
        const {tap} = state.taps;
        const {model} = state.laser;
        return {
            model,
            modelCount: state.laser.modelCount,
            tap,
            workHeight: workHeightLaser,
            frontEnd: FRONT_END.LASER,
            advance,
            theme: state.theme.resolved,
            jobTracker: state.jobTracker,
            plotProgress: state.plotProgress,
            showTravel: state.viewOptions.showTravel
        };
    },
    (dispatch) => {
        return {
            setRendererParent: (modelsParent) => dispatch(laserActions.setRendererParent(modelsParent)),
            selectModel: (model) => dispatch(laserActions.selectModel(model)),
            updateTransformation: (key, value, preview) => dispatch(laserActions.updateTransformation(key, value, preview)),
            addModel: (fileType, file) => dispatch(laserActions.addModel(fileType, file)),
        };
    }
)(Index);
export default Canvas2dPen
export {Canvas2dPen, Canvas2dLaser}