import * as THREE from 'three';
import {degree2radian, getUuid, getAvailableSize, getIsAdvance} from '../../../utils/index.js';
import socketClientManager from '../../../socket/socketClientManager';
import notificationI18n from '../../../utils/notificationI18n';
import toolPathRenderer, {drawingColor, PLOT_PROGRESS_COLOR, PLOT_TRAVEL_DONE_COLOR} from './toolPathRenderer';
import {drawnForModel, drawnSegments} from '../../../utils/plotProgress.js';
import {createResizeHandle, createRotateHandle, RESIZE_HANDLE_SIZE, applyCanvasPalette as applyHandleColour} from './handles.js';
import inWorkArea2D from '../../../utils/inWorkArea2D';
import {getLimit} from '../../../utils/workAreaUtils';
import {canvasPalette} from '../../../utils/canvasPalette';
import {settingsNumber, settingField, setSetting} from '../../../utils/settings.js';
import {disposeObject3d, replaceGeometry} from '../../../utils/disposeObject3d.js';

const getSizeRestriction = (settings, advance) => {
    const min_width = settingField(settings, 'transformation.width', 'minimum_value', 0);
    const max_width_setting = settingField(settings, 'transformation.width', 'maximum_value', undefined);
    // A missing maximum_value means no upper limit (SVG width/height).
    const max_width = advance || max_width_setting === undefined
        ? Number.MAX_SAFE_INTEGER
        : max_width_setting;
    const min_height = settingField(settings, 'transformation.height', 'minimum_value', 0);
    const max_height_setting = settingField(settings, 'transformation.height', 'maximum_value', undefined);
    const max_height = advance || max_height_setting === undefined
        ? Number.MAX_SAFE_INTEGER
        : max_height_setting;
    return {min_width, max_width, min_height, max_height}
};

// Model2D stays rotation=0, scale=1; only position changes. Children: toolPathObj3d, imgObj3d,
// edgeObj3d (remove(null) is safe on a three.js Object3D).
//
// Shared by the laser and write & draw tabs; they differ in their settings set, toolpath event,
// front-end work area and g-code emitter, all supplied through `options`.
export default class Model2DBase extends THREE.Group {
    constructor(fileType, options) {
        super();
        this.options = options;
        this.fileType = fileType;
        this.url = "";
        this.img_width = 1;
        this.img_height = 1;
        this._isSelected = false;

        this.settings = options.createSettings(fileType);
        this.sizeRestriction = getSizeRestriction(this.settings, getIsAdvance());

        this.toolPathObj3d = null; // rendered tool path
        this.toolPathLines = null;
        this.toolPathId = "";

        this.imgObj3d = new THREE.Mesh(); // rendered image

        this.edgeObj3d = null; // selection outline
        this.handles = null; // corner resize and rotation handles
        this.rotateLine = null;

        this.isPreviewed = false;
        this.isPreviewing = false; // only tracked when options.trackPreviewing
        // Pen-up moves are not drawn unless the canvas asks for them; see loadToolPath.
        this.travelVisible = false;
        this.inWorkArea = true;

        // data: {toolPathLines, toolPathId}
        //
        // Subscribed through options.messaging when the caller supplies one. The socket is a process-wide
        // singleton that is not connected at import, so without this the model cannot be constructed outside a
        // running app: building one registers a listener on a null client. A test supplies its own two
        // methods; the app supplies nothing and gets the socket.
        this.messaging = options.messaging ?? socketClientManager;
        this._listener = this.messaging.addServerListener(options.previewEvent, (data) => {
            if (this.toolPathId !== data.toolPathId) return;
            if (data.error) {
                this._setPreviewing(false);
                console.error("toolpath generation failed:", data.error);
                notificationI18n.error({
                    message: "Generate toolpath failed",
                    description: String(data.error),
                    duration: 8
                });
                return;
            }
            this.loadToolPath(data.toolPathLines);
            this._setPreviewing(false);
            this.isPreviewed = true;
            this.dispatchEvent({type: 'preview', data: {isPreviewed: this.isPreviewed}});
        });
        this.position.y = settingsNumber(this.settings, 'transformation.y', 0); // default position
    }

    // The write & draw canvas shows a spinner while a preview is in flight; the laser canvas does not.
    _setPreviewing(value) {
        if (this.options.trackPreviewing) this.isPreviewing = value;
    }

    // The write & draw module squeezes an example drawing to a fixed width.
    resolveSize(size, img_width, img_height, isExampleAndInit) {
        return size;
    }

    // Hook for a subclass to react once the plane exists.
    afterImageLoaded(width, height, img_width, img_height, isExampleAndInit) {
    }

    loadImg(url, img_width, img_height, isExampleAndInit) {
        this.url = url;
        this.img_width = img_width;
        this.img_height = img_height;

        const {width, height} = this.resolveSize(
            getAvailableSize(img_width, img_height, this.sizeRestriction),
            img_width, img_height, isExampleAndInit
        );

        const loader = new THREE.TextureLoader();
        const texture = loader.load(url);

        // A second drawing reuses this mesh, so the geometry, the material and the texture it held have to go
        // first: an image texture is megabytes and the loader has already given us a new one.
        if (this.imgObj3d.geometry) this.imgObj3d.geometry.dispose();
        if (this.imgObj3d.material) {
            if (this.imgObj3d.material.map) this.imgObj3d.material.map.dispose();
            this.imgObj3d.material.dispose();
        }
        this.imgObj3d.geometry = new THREE.PlaneGeometry(width, height);
        this.imgObj3d.material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1,
            map: texture,
            side: THREE.DoubleSide
        });
        this.add(this.imgObj3d);

        setSetting(this.settings, 'transformation.img_width', img_width);
        setSetting(this.settings, 'transformation.img_height', img_height);

        setSetting(this.settings, 'transformation.width', width);
        setSetting(this.settings, 'transformation.height', height);

        setSetting(this.settings, 'transformation.rotation', 0);

        this._display('img');
        this._display('edge');

        this.afterImageLoaded(width, height, img_width, img_height, isExampleAndInit);
    }

    loadToolPath(toolPathLines) {
        // The old toolpath's buffers are not freed by removing it, and this runs on every preview and on every
        // click of the travel-line toggle.
        this.remove(this.toolPathObj3d);
        disposeObject3d(this.toolPathObj3d);
        this.toolPathLines = toolPathLines;

        // The renderer builds the pen-up moves only when it is given a colour for them. That is the one place
        // this is decided, so the toolbar's toggle re-renders rather than trying to hide a part of the scene:
        // geometry is a few milliseconds, and no engine round trip is involved.
        const travelColor = this.travelVisible === true ? this.options.travelColor : null;
        this.toolPathObj3d = toolPathRenderer.render(this.toolPathLines, travelColor);
        if (this.toolPathObj3d) this.add(this.toolPathObj3d);

        // A new toolpath is a new set of segments, so any progress overlay describes geometry that no
        // longer exists. It is rebuilt on the next progress update, from this toolpath's own segments.
        this._plotOverlays = null;
        this._applyPlotProgress();

        this._display('toolPath');
    }

    /**
     * Tell this model where it sits in the assembled job: its offset in executable-line space, and the
     * toolpath-line to G-code-line mapping the emitter produced. Called when the job is generated, which
     * is the first moment the gcode exists.
     */
    setPlotLineMap({startLine = 0, lineCount = 0, execOrdinal = null} = {}) {
        this._plotLineMap = {startLine, lineCount, execOrdinal};
        this._plotDrawn = 0;
        this._applyPlotProgress();
    }

    /** `sentGlobal` counts executable lines from the top of the assembled job. */
    setPlotProgress(sentGlobal) {
        this._plotSent = sentGlobal;
        this._applyPlotProgress();
    }

    clearPlotProgress() {
        for (const overlay of this._plotOverlays || []) overlay.geometry.setDrawRange(0, 0);
    }

    /**
     * Move the cut-off: everything before it is red (artwork) or grey (travel already crossed).
     *
     * The overlay is a second copy of the same vertices with a range drawn, so a progress update is one
     * setDrawRange call per object - no buffer upload, no re-render of the toolpath. The copy is made with
     * its own Float32BufferAttribute rather than sharing the drawing's: disposeObject3d frees geometry
     * buffers, and a shared attribute would leave whichever object outlived the other drawing nothing.
     */
    _applyPlotProgress() {
        const group = this.toolPathObj3d;
        const progress = group && group.userData && group.userData.progress;
        const map = this._plotLineMap;
        if (!progress || !map || !map.execOrdinal) {
            this.clearPlotProgress();
            return;
        }
        const drawn = drawnForModel(this._plotSent === undefined ? 0 : this._plotSent, map);
        this._plotDrawn = drawn;
        if (!this._plotOverlays) this._plotOverlays = this._buildPlotOverlays(group, progress);
        for (const overlay of this._plotOverlays) {
            const lines = overlay.userData.plotLines;
            const count = drawnSegments(lines, map.execOrdinal, drawn);
            const perUnit = overlay.userData.plotUnit;
            overlay.geometry.setDrawRange(0, count * perUnit);
        }
    }

    _buildPlotOverlays(group, progress) {
        const make = (source, lines, color, kind) => {
            if (!source || lines.length === 0) return null;
            const attribute = source.geometry.getAttribute('position');
            if (!attribute) return null;
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position',
                new THREE.Float32BufferAttribute(new Float32Array(attribute.array), 3));
            const material = kind === 'points'
                ? new THREE.PointsMaterial({size: 0.4, color})
                : new THREE.LineBasicMaterial({color, transparent: true});
            const overlay = kind === 'points'
                ? new THREE.Points(geometry, material)
                : new THREE.LineSegments(geometry, material);
            overlay.name = 'plotProgress';
            overlay.userData.plotLines = lines;
            // LineSegments take two vertices per segment, Points one per vertex.
            overlay.userData.plotUnit = kind === 'points' ? 1 : 2;
            group.add(overlay);
            return overlay;
        };

        const overlays = [];
        if (progress.drawing) {
            overlays.push(make(group.getObjectByName('drawing'), progress.drawing,
                PLOT_PROGRESS_COLOR, 'lines'));
        }
        if (progress.travel) {
            overlays.push(make(group.getObjectByName('travel'), progress.travel,
                PLOT_TRAVEL_DONE_COLOR, 'lines'));
        }
        if (progress.points) {
            overlays.push(make(group, progress.points, PLOT_PROGRESS_COLOR, 'points'));
        }
        return overlays.filter(Boolean);
    }

    /**
     * Draw the toolpath with or without its pen-up moves.
     */
    setTravelVisible(visible) {
        const next = visible === true;
        if (this.travelVisible === next) return;
        this.travelVisible = next;
        if (this.toolPathLines) this.loadToolPath(this.toolPathLines);
    }

    /**
     * Repaint the parts this file colours itself after the canvas switched theme: the rotate
     * guide, the toolpath and the shared transform handles. The imported picture is left alone -
     * it is the user's artwork, not chrome. Visibility is preserved, so a model showing its
     * picture does not jump to its toolpath.
     */
    applyCanvasPalette() {
        if (this.rotateLine) {
            this.rotateLine.material.color.set(canvasPalette().handle);
        }
        applyHandleColour();
        if (this.toolPathLines && this.toolPathObj3d) {
            this.recolourToolPath();
        }
    }

    /**
     * Only the two colours have changed, and building a long toolpath takes long enough that the
     * stall shows, so the existing line materials are recoloured where possible. A point-mode
     * toolpath keeps its colours in vertex attributes, so that one is built again.
     */
    recolourToolPath() {
        let vertexColoured = false;
        this.toolPathObj3d.traverse((o) => {
            if (o.isPoints) vertexColoured = true;
        });

        if (!vertexColoured) {
            this.toolPathObj3d.traverse((o) => {
                if (!o.material) return;
                o.material.color.set(o.name === 'travel' ? this.options.travelColor : drawingColor());
            });
            return;
        }

        const visible = this.toolPathObj3d.visible;
        this.remove(this.toolPathObj3d);
        this.toolPathObj3d = toolPathRenderer.render(this.toolPathLines, this.options.travelColor);
        this.toolPathObj3d.visible = visible;
        this.add(this.toolPathObj3d);
    }

    // type: img, toolPath or edge
    _display(type) {
        switch (type) {
            case "img":
                this.imgObj3d && (this.imgObj3d.visible = true);
                this.toolPathObj3d && (this.toolPathObj3d.visible = false);
                break;
            case "toolPath":
                this.imgObj3d && (this.imgObj3d.visible = false);
                this.toolPathObj3d && (this.toolPathObj3d.visible = true);
                break;
            case "edge":
                if (this._isSelected) {
                    this.remove(this.edgeObj3d);
                    disposeObject3d(this.edgeObj3d);
                    const geometry = new THREE.EdgesGeometry(this.imgObj3d.geometry);
                    const color = this.inWorkArea ? 0x007700 : 0xFF0000;
                    this.edgeObj3d = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color: color}));
                    this.add(this.edgeObj3d);
                } else {
                    this.edgeObj3d && (this.edgeObj3d.visible = false);
                }
                break;
        }
    }

    updateTransformation(key, value, preview, workHeight, isLockScale) {
        switch (key) {
            case "width": {
                const mWidth = value;
                const mHeight = this.img_height * (mWidth / this.img_width);
                const {width, height} = getAvailableSize(mWidth, mHeight, this.sizeRestriction);

                setSetting(this.settings, 'transformation.width', width);
                setSetting(this.settings, 'transformation.height', !isLockScale
                    ? settingsNumber(this.settings, 'transformation.height', height)
                    : height);
                const rotation = settingsNumber(this.settings, 'transformation.rotation', 0);
                replaceGeometry(this.imgObj3d, new THREE.PlaneGeometry(width, height).rotateZ(degree2radian(rotation)));
                break;
            }
            case "height": {
                const mHeight = value;
                const mWidth = this.img_width * (mHeight / this.img_height);
                const {width, height} = getAvailableSize(mWidth, mHeight, this.sizeRestriction);

                setSetting(this.settings, 'transformation.width', !isLockScale
                    ? settingsNumber(this.settings, 'transformation.width', width)
                    : width);
                setSetting(this.settings, 'transformation.height', height);
                const rotation = settingsNumber(this.settings, 'transformation.rotation', 0);
                replaceGeometry(this.imgObj3d, new THREE.PlaneGeometry(width, height).rotateZ(degree2radian(rotation)));
                break;
            }
            case "rotation": {
                const width = settingsNumber(this.settings, 'transformation.width', 0);
                const height = settingsNumber(this.settings, 'transformation.height', 0);
                replaceGeometry(this.imgObj3d, new THREE.PlaneGeometry(width, height).rotateZ(degree2radian(value)));
                setSetting(this.settings, 'transformation.rotation', value);
                break;
            }
            case "x":
                this.position.x = value;
                setSetting(this.settings, 'transformation.x', value);
                break;
            case "y":
                this.position.y = value;
                setSetting(this.settings, 'transformation.y', value);
                break;
            case "flip_model":
                setSetting(this.settings, 'transformation.flip_model', value);
                break;
        }

        const {outerRadius, innerRadius} = getLimit(workHeight, this.options.frontEnd)

        this.inWorkArea = getIsAdvance()
            ? true
            : inWorkArea2D(
                innerRadius,
                outerRadius,
                this.position.x,
                this.position.y,
                settingsNumber(this.settings, 'transformation.width', 0),
                settingsNumber(this.settings, 'transformation.height', 0),
                settingsNumber(this.settings, 'transformation.rotation', 0)
            )

        this._display("edge");
        this._updateHandles();

        if (preview) {
            this._display("img");
            this.preview();
        }
    }

    updateConfig(key, value) {
        // Nested keys arrive as "parent.child"; setSetting walks that path.
        setSetting(this.settings, `config.${key}`, value);

        this.preview();
    }

    updateWorkingParameters(key, value) {
        setSetting(this.settings, `working_parameters.${key}`, value);
    }

    setSelected(isSelected) {
        this._isSelected = isSelected;
        if (isSelected) {
            this._createHandles();
            this._updateHandles();
            this._setHandlesVisible(true);
        } else if (this.handles) {
            this._setHandlesVisible(false);
        }
        this._display("edge");
    }

    _createHandles() {
        if (this.handles) return;
        this.handles = {};
        const trackHandle = (object, type, isRotate) => {
            object.userData.handleType = type;
            if (isRotate) {
                object.userData.isRotateHandle = true;
            } else {
                object.userData.isResizeHandle = true;
            }
            this.add(object);
            return object;
        };
        for (const key of ['tl', 'tr', 'bl', 'br']) {
            this.handles[key] = trackHandle(createResizeHandle(), key, false);
        }
        this.handles.rotate = trackHandle(createRotateHandle(), 'rotate', true);

        const lineMaterial = new THREE.LineBasicMaterial({color: canvasPalette().handle, depthTest: false, transparent: true});
        this.rotateLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(), new THREE.Vector3()
        ]), lineMaterial);
        this.rotateLine.renderOrder = 998;
        this.add(this.rotateLine);
    }

    _setHandlesVisible(visible) {
        if (!this.handles) return;
        for (const key of Object.keys(this.handles)) this.handles[key].visible = visible;
        if (this.rotateLine) this.rotateLine.visible = visible;
    }

    _updateHandles() {
        if (!this.handles) return;
        const width = settingsNumber(this.settings, 'transformation.width', 0);
        const height = settingsNumber(this.settings, 'transformation.height', 0);
        const rotation = degree2radian(settingsNumber(this.settings, 'transformation.rotation', 0));
        const origin = new THREE.Vector2(0, 0);
        const rot = (x, y) => new THREE.Vector2(x, y).rotateAround(origin, rotation);
        // A corner handle is centred on the corner, so half of it lies over the artwork and reads as
        // inset into the selection. Push each one out along its diagonal until it clears the edge.
        const out = RESIZE_HANDLE_SIZE / 2 + 1.5;
        const corners = {
            tl: rot(-width / 2 - out, height / 2 + out),
            tr: rot(width / 2 + out, height / 2 + out),
            bl: rot(-width / 2 - out, -height / 2 - out),
            br: rot(width / 2 + out, -height / 2 - out),
        };
        for (const key of Object.keys(corners)) {
            this.handles[key].position.set(corners[key].x, corners[key].y, 1);
        }
        const topMid = rot(0, height / 2);
        const up = rot(0, 1);
        const rotatePos = topMid.clone().addScaledVector(up, 8);
        this.handles.rotate.position.set(rotatePos.x, rotatePos.y, 1);
        if (this.rotateLine) {
            const lineEnd = rotatePos.clone().addScaledVector(up, -3);
            this.rotateLine.geometry.setFromPoints([
                new THREE.Vector3(topMid.x, topMid.y, 0.5),
                new THREE.Vector3(lineEnd.x, lineEnd.y, 0.5),
            ]);
        }
    }

    getHandleWorldPositions() {
        if (!this.handles) return null;
        this.updateMatrixWorld();
        const result = {};
        for (const key of ['tl', 'tr', 'bl', 'br', 'rotate']) {
            result[key] = this.handles[key].getWorldPosition(new THREE.Vector3());
        }
        return result;
    }

    getCenterWorldPosition() {
        return this.getWorldPosition(new THREE.Vector3());
    }

    preview() {
        this.toolPathId = getUuid();
        socketClientManager.emitToServer(this.options.previewEvent, {
            url: this.url,
            settings: this.settings,
            toolPathId: this.toolPathId,
            fileType: this.fileType
        });

        this._setPreviewing(true);
        this.isPreviewed = false;
        this.dispatchEvent({type: 'preview', data: {isPreviewed: this.isPreviewed}});
    }

    generateGcode() {
        throw new Error('generateGcode must be implemented by the subclass');
    }

    clone() {
        const instance = new this.constructor(this.fileType);

        const url = this.url;
        const img_width = settingsNumber(this.settings, 'transformation.img_width', this.img_width);
        const img_height = settingsNumber(this.settings, 'transformation.img_height', this.img_height);

        instance.loadImg(url, img_width, img_height)

        return instance;
    }

    dispose() {
        if (this._listener) {
            this.messaging.removeServerListener(this.options.previewEvent, this._listener);
            this._listener = null;
        }
        // The toolpath was the largest buffer in the scene and the one this method forgot: a preview leaves
        // thousands of line segments behind, and a model is disposed every time its drawing is replaced.
        if (this.imgObj3d && this.imgObj3d.material && this.imgObj3d.material.map) {
            this.imgObj3d.material.map.dispose();
        }
        disposeObject3d(this.imgObj3d);
        disposeObject3d(this.edgeObj3d);
        disposeObject3d(this.toolPathObj3d);
        if (this.handles) {
            for (const key of Object.keys(this.handles)) {
                const handle = this.handles[key];
                // The handle's picture is its own texture, made by createResizeHandle, so it goes with it.
                if (handle.material.map) handle.material.map.dispose();
                disposeObject3d(handle);
            }
        }
        disposeObject3d(this.rotateLine);
        this.imgObj3d = null;
        this.edgeObj3d = null;
        this.toolPathObj3d = null;
        this.toolPathLines = null;
        this.handles = null;
        this.rotateLine = null;
    }
}
