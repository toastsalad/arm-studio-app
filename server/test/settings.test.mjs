import test from 'node:test';
import assert from 'node:assert/strict';

import {
    hasSetting,
    settingsBool,
    settingsNode,
    settingsNumber,
    settingsPlaceholder,
    settingsString,
} from '../src/settings.js';

// A settings blob is a tree of category nodes ({children}) and leaf nodes ({default_value}).
const node = (default_value, extra = {}) => ({default_value, ...extra});
const settings = {
    start_gcode: node('; start'),
    transformation: {
        children: {
            width: node(120),
            rotation: node('45'),
            flip_model: node('Both'),
            offset: node('#offset#'),
        }
    },
    config: {
        children: {
            fill: {default_value: true, children: {fill_density: node(4)}},
            invert: node(false),
            cross_hatch: node(false),
            density: node('not a number'),
        }
    },
    working_parameters: {
        children: {
            power: node(50, {placeholder: '#power#'}),
        }
    }
};

test('a dotted path walks the .children of each category', () => {
    assert.equal(settingsNumber(settings, 'transformation.width', 0), 120);
    assert.equal(settingsNumber(settings, 'config.fill.fill_density', 0), 4);
    assert.equal(settingsString(settings, 'start_gcode', ''), '; start');
});

test('a numeric string is a number; a non-numeric one is the fallback', () => {
    assert.equal(settingsNumber(settings, 'transformation.rotation', 0), 45);
    assert.equal(settingsNumber(settings, 'config.density', 4), 4);
});

test('a missing key, a null and a placeholder all give the fallback', () => {
    assert.equal(settingsNumber(settings, 'config.nope', 7), 7);
    assert.equal(settingsNumber(settings, 'transformation.offset', 7), 7);
    assert.equal(settingsString(settings, 'config.nope', 'x'), 'x');
    assert.equal(settingsBool(settings, 'config.nope', true), true);
});

test('hasSetting distinguishes unset from set-to-the-fallback', () => {
    assert.equal(hasSetting(settings, 'config.fill'), true);
    assert.equal(hasSetting(settings, 'config.fill.fill_density'), true);
    assert.equal(hasSetting(settings, 'config.nope'), false);
});

test('the placeholder is read separately from the default value', () => {
    assert.equal(settingsPlaceholder(settings, 'working_parameters.power', ''), '#power#');
    assert.equal(settingsPlaceholder(settings, 'transformation.width', ''), '');
});

test('the raw node is available for structural questions', () => {
    assert.deepEqual(settingsNode(settings, 'config.fill').children, {fill_density: node(4)});
    assert.equal(settingsNode(settings, 'config.nope'), undefined);
});
