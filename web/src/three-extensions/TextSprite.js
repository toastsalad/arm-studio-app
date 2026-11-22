import * as THREE from 'three';

// The palette carries packed 0xrrggbb numbers, the way three.js does; a 2d context wants a CSS
// colour. Strings are passed through, so either form can be given.
const cssColour = (value) => typeof value === 'number'
    ? `#${value.toString(16).padStart(6, '0')}`
    : value;

// TextSprite
class TextSprite {
    constructor(options) {
        options = options || {};
        let { opacity = 0.6, size = 10 } = options;

        let textObject = new THREE.Object3D();
        let textHeight = 100;
        let textWidth = 0;

        let canvas = document.createElement('canvas');
        let context = canvas.getContext('2d');
        context.font = 'normal ' + textHeight + 'px Arial';
        let metrics = context.measureText(options.text);
        textWidth = metrics.width;

        canvas.width = textWidth;
        canvas.height = textHeight;

        context.font = 'normal ' + textHeight + 'px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = cssColour(options.color);
        context.fillText(options.text, textWidth / 2, textHeight / 2);

        let texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearFilter;

        let material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: opacity
        });

        textObject.position.x = options.x || 0;
        textObject.position.y = options.y || 0;
        textObject.position.z = options.z || 0;
        textObject.textHeight = size;
        textObject.textWidth = (textWidth / textHeight) * textObject.textHeight;

        let sprite = new THREE.Sprite(material);
        sprite.scale.set(textWidth / textHeight * size, size, 1);

        textObject.add(sprite);

        return textObject;
    }
}

export default TextSprite;
