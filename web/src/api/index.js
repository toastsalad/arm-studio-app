
// POST a single multipart field and return the parsed JSON response.
const postForm = (url, field, file) => {
    const formData = new FormData();
    formData.append(field, file);
    return fetch(window.serverAddress + url, {
        method: 'POST',
        body: formData
    }).then(response => response.json());
};

// response: {url: "http://localhost:3002/1587458545878.jpg"}
const uploadFile = (file) => postForm('/uploadFile', 'file', file);

// response: {url: "...", width: 500, height: 575}
const uploadImage = (file) => postForm('/uploadImage', 'file', file);

const uploadFont = (fontFile) => postForm('/font/upload', 'file', fontFile);

const deleteFont = (font) => postForm('/font/delete', 'font', font);

const listFonts = () => {
    return fetch(window.serverAddress + '/font/list', {
        method: 'POST'
    }).then(response => response.json());
};


export {uploadFile, uploadImage, uploadFont, deleteFont, listFonts}
