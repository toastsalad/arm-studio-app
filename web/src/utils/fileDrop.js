import messageI18n from './messageI18n';

const getExtension = (name) => {
    const dotIndex = name.lastIndexOf('.');
    return dotIndex === -1 ? '' : name.slice(dotIndex).toLowerCase();
};

// Allow the drop and show the "copy" cursor while dragging over the canvas.
export const onDragOverFile = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
};

// Returns the first dropped file with one of `extensions`, or null.
export const getDroppedFile = (event, extensions) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return null;
    if (extensions.includes(getExtension(file.name))) return file;
    messageI18n.warning(`Only ${extensions.join(', ')} files are supported`);
    return null;
};
