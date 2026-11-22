import {
    Object3D,
    Vector2
} from 'three';
import RectangleHelper from '../../../../three-extensions/RectangleHelper.jsx';
import PrintablePlate from "./PrintablePlate.js"

class PrintableCube extends Object3D {
    constructor(size) {
        super();
        this.type = 'PrintCube';
        this.size = size;
        this._setup();
    }

    updateSize(size) {
        this.size = size;
        this.remove(...this.children);
        this._setup();
    }

    update = () => {
        this.dispatchEvent({type: 'update'});
    };

    _setup() {
        const bottom = new PrintablePlate(new Vector2(this.size.x / 2, this.size.y / 2))

        bottom.position.set(0, 0, 0);
        bottom.rotation.x = Math.PI / 2; // flip to show left bottom point as zero
        this.add(bottom);

        const top = new RectangleHelper(this.size.x, this.size.y);
        top.position.set(0, this.size.z, 0);
        this.add(top);

        const left = new RectangleHelper(this.size.z, this.size.y);
        left.rotateZ(Math.PI / 2);
        left.position.set(-this.size.x / 2, this.size.z / 2, 0);
        this.add(left);

        const right = new RectangleHelper(this.size.z, this.size.y);
        right.rotateZ(Math.PI / 2);
        right.position.set(this.size.x / 2, this.size.z / 2, 0);
        this.add(right);

        const front = new RectangleHelper(this.size.x, this.size.z);
        front.rotateX(Math.PI / 2);
        front.position.set(0, this.size.z / 2, this.size.y / 2);
        this.add(front);

        const back = new RectangleHelper(this.size.x, this.size.z);
        back.rotateX(Math.PI / 2);
        back.position.set(0, this.size.z / 2, -this.size.y / 2);
        this.add(back);
    }
}

export default PrintableCube;
