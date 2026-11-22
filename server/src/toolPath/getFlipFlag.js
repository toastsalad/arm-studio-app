const getFlipFlag = (flipModel) => {
    switch (flipModel) {
        case "None":
            return 0;
        case "Vertical":
            return 1;
        case "Horizontal":
            return 2;
        case "Both":
            return 3;
        default:
            return null;
    }
};

export default getFlipFlag;
