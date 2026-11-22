import {combineReducers} from 'redux';
import laser from "./laser";
import writeAndDraw from "./writeAndDraw";
import p3dModel from "./p3dModel";
import p3dMaterialSettings from "./p3dMaterialSettings";
import p3dPrintSettings from "./p3dPrintSettings";
import p3dSettingVisibility from "./p3dSettingVisibility";
import serialPort from "./serialPort";
import socket from "./socket";
import taps from "./taps";
import settingsGeneral from "./settingsGeneral";
import persistentData from "./persistentData";
import fonts from "./fonts";
import theme from "./theme";
import viewOptions from './viewOptions';
import jobTracker from "./jobTracker";
import plotProgress from "./plotProgress";

// Deliberately still plain "set these fields" reducers: p3dSettingsFactory,
// p3dSettingVisibility, serialPort, socket, taps, settingsGeneral, persistentData, fonts
// and theme hold no rules beyond assigning a value, so a named action for each field
// would be ceremony rather than a statement of intent. The slices above carry state
// transitions worth naming (a job's authority switch, a drawing's derived g-code, a
// slice lifecycle).
export default combineReducers({
    laser,
    writeAndDraw,
    p3dModel,
    p3dMaterialSettings,
    p3dPrintSettings,
    p3dSettingVisibility,
    serialPort,
    socket,
    taps,
    settingsGeneral,
    persistentData,
    fonts,
    theme,
    jobTracker,
    plotProgress,
    viewOptions
});
