import * as THREE from 'three';

const ThreeUtils = {
    // Quaternion that rotates `second` onto `first`.
    getQuaternionBetweenVector3: function (first, second) {
        return new THREE.Quaternion().setFromUnitVectors(
            second.clone().normalize(),
            first.clone().normalize()
        );
    },

    // Matrix that rotates v2 onto v1.
    getRotateMatrixBetweenVector3: function (v1, v2){
        const quaternion = ThreeUtils.getQuaternionBetweenVector3(v1, v2);
        const matrix4 = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
        return matrix4;
    },

    getMouseXY: function(event, domElement) {
        var rect = domElement.getBoundingClientRect();
        return new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        )
    },

    getObjectWorldPosition: function (object) {
        const result = new THREE.Vector3();
        object.getWorldPosition(result);
        return result;
    },

    getObjectWorldQuaternion: function (object) {
        const result = new THREE.Quaternion();
        object.getWorldQuaternion (result);
        return result;
    },

    getObjectWorldScale: function (object) {
        const result = new THREE.Vector3();
        object.getWorldScale(result);
        return result;
    },

    getEventWorldPosition: function (event, domElement, camera) {
        var rect = domElement.getBoundingClientRect();
        var ray = new THREE.Vector3();

        // standardX and standardY are in the standard three.js range [-1, 1].
        const standardX =  ((event.clientX - rect.left) / rect.width ) * 2 - 1;
        const standardY = -((event.clientY - rect.top) / rect.height ) * 2 + 1;

        ray.set(standardX, standardY, 0.5);

        ray.unproject(camera );
        ray.sub(camera.position ).normalize();
        var distance = -camera.position.z / ray.z;

        var result = new THREE.Vector3().copy(camera.position).add(ray.multiplyScalar(distance));
        return result;
    },

    setObjectWorldPosition: function(object, position) {
        const parent = object.parent;
        parent.updateMatrixWorld();
        const matrix = new THREE.Matrix4().copy(parent.matrixWorld).invert();
        position.applyMatrix4(matrix);
        object.position.copy(position);
    },

    setObjectWorldScale: function (object, scale) {
        var localScale = object.parent.worldToLocal(scale);
        object.scale.copy(localScale);
    },

    setObjectWorldQuaternion: function (object, quaternion) {
        object.setRotationFromQuaternion(quaternion);

        const parentQuaternion = ThreeUtils.getObjectWorldQuaternion(object.parent);
        object.applyQuaternion(parentQuaternion.inverse());
    },

    scaleObjectToWorldSize: function (object, targetSize, pivot) {
        const originSize2D = ThreeUtils.getGeometrySize(object.geometry, true);

        const originPos = ThreeUtils.getObjectWorldPosition(object);
        const originScale = ThreeUtils.getObjectWorldScale(object);

        const scaleX = targetSize.x / originSize2D.x;
        const scaleY = targetSize.y / originSize2D.y;

        const worldScale = new THREE.Vector3(scaleX, scaleY, 1);
        ThreeUtils.setObjectWorldScale(object, worldScale );

        const deltaX = (scaleX - originScale.x) * originSize2D.x;
        const deltaY = (scaleY - originScale.y) * originSize2D.y;

        const newPos = originPos.clone();
        const delta = new THREE.Vector3();
        switch (pivot) {
            case 'top_left':
                delta.x = deltaX / 2;
                delta.y = -deltaY / 2;
                break;
            case 'top_right':
                delta.x = -deltaX / 2;
                delta.y = -deltaY / 2;
                break;
            case 'bottom_left':
                delta.x = deltaX / 2;
                delta.y = deltaY / 2;
                break;
            case 'bottom_right':
                delta.x = -deltaX / 2;
                delta.y = deltaY / 2;
                break;
            default: // center
                break;
        }
        newPos.add(delta);
        ThreeUtils.setObjectWorldPosition(object, newPos);
    },

    getGeometrySize: function (geometry, is2D) {
        geometry.computeBoundingBox();
        const boundingBox = geometry.boundingBox;
        const size = new THREE.Vector3(
            boundingBox.max.x - boundingBox.min.x,
            boundingBox.max.y - boundingBox.min.y,
            boundingBox.max.z - boundingBox.min.z
        );
        if (is2D){
            return new THREE.Vector2(size.x, size.y);
        } else {
            return size;
        }
    }

};

export default ThreeUtils;
