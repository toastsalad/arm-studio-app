/* global require */
// `require` with a template literal is webpack's context form; see ConfigSvgOptions.
import React from 'react';
import {Checkbox, Row, Col, Collapse} from 'antd';
import {ConfigText, ConfigSelect} from '../../../../components/Config';
import NumberInput from '../../../../components/NumberInput/Index.jsx';

//only display the following types
const PARAMETER_TYPES_DISPLAYED = [
    "category",
    "float",
    "int",
    "enum",
    "bool",
];

const ignoreChildrenKeys = [
    'infill_sparse_density'
]

const convertOptions = (options, t) => {
    const result = [];
    for (let key in options) {
        result.push({label: t(options[key]), value: key});
    }
    return result;
};

/**
 * Render category children
 * @param children category children
 * @param categoryKey category key
 * @param keyChainFilter key chain filter, null for all
 * @param t                  i18n
 * @param tooltipId
 * @param updateSettingFunc  function
 * @param editable whether parameters can be edited
 * @returns {Array}
 */
const renderCategoryChildren = (children, categoryKey, keyChainFilter, t, tooltipId, updateSettingFunc, editable = false) => {
    let result = [];
    for (let key in children) {
        let keyChain = `${categoryKey}.${key}`; // e.g. resolution.layer_height, resolution.line_width.wall_line_width.wall_line_width_0
        if (keyChainFilter && keyChainFilter.length > 0 && !keyChainFilter.includes(keyChain)) {
            continue;
        }
        const offset = keyChain.split(".").length - 2;
        const child = children[key];
        if (child.visible === false) {
            continue;
        }
        if (child instanceof Object) {
            if (!PARAMETER_TYPES_DISPLAYED.includes(child.type)) {
                continue;
            }

            const hideChildren = ignoreChildrenKeys.includes(key);

            if (child.children && !hideChildren) {
                let {label, description} = child;
                result.push(
                    <div key={keyChain}>
                        <Row
                            style={{marginTop: "8px"}}
                            data-tooltip-id={tooltipId}
                            data-tooltip-content={t(description)}
                        >
                            <Col span={24 - offset} offset={offset}>
                                <ConfigText text={t(label)}/>
                            </Col>
                        </Row>
                    </div>
                );
                result = result.concat(renderCategoryChildren(child.children, `${keyChain}.children`, keyChainFilter, t, tooltipId, updateSettingFunc, editable))
            } else {
                let {label, description, unit, type, default_value, minimum_value, maximum_value, options} = child;
                if (!minimum_value) {
                    minimum_value = 0;
                }
                if (!maximum_value) {
                    maximum_value = 1000;
                }

                result.push(
                    <div key={keyChain}>
                        <Row
                            style={{marginTop: "8px"}}
                            data-tooltip-id={tooltipId}
                            data-tooltip-content={`${t(description)}${unit ? ` (${unit})` : ''}`}
                        >
                            <Col span={16 - offset} offset={offset}>
                                <ConfigText text={t(label)}/>
                            </Col>
                            <Col span={1}/>
                            {type === "float" &&
                            <Col span={7}>
                                {/* {categoryKey} / {key} */}
                                <NumberInput
                                    disabled={!editable}
                                    precision={2}
                                    min={minimum_value}
                                    max={maximum_value}
                                    value={default_value}
                                    onAfterChange={(value) => {
                                        updateSettingFunc(keyChain, value)
                                    }}
                                />
                            </Col>
                            }
                            {type === "int" &&
                            <Col span={7}>
                                <NumberInput
                                    disabled={!editable}
                                    precision={0}
                                    min={minimum_value}
                                    max={maximum_value}
                                    value={default_value}
                                    onAfterChange={(value) => {
                                        updateSettingFunc(keyChain, value)
                                    }}
                                />
                            </Col>
                            }
                            {type === "bool" &&
                            <Col span={7}>
                                <Checkbox
                                    disabled={!editable}
                                    checked={default_value}
                                    onChange={(e) => {
                                        updateSettingFunc(keyChain, e.target.checked)
                                    }}
                                />
                            </Col>
                            }
                            {type === "enum" &&
                            <Col span={7}>
                                <ConfigSelect
                                    disabled={!editable}
                                    options={convertOptions(options, t)}
                                    value={default_value}
                                    onChange={(value) => {
                                        updateSettingFunc(keyChain, value)
                                    }}
                                />
                            </Col>
                            }
                        </Row>
                    </div>
                );
            }
        }
    }
    return result;
};

/**
 * Wrap in Collapse.Panel
 * @param header panel header text
 * @param icon panel icon (svg name)
 * @param elements
 * @returns {Array}
 */
const wrapCollapsePanel = (header, icon, elements) => {
    const result = [];
    let extra = null;
    if (icon) {
        extra = <img className="app-artwork" style={{width: "18px", height: "18px"}} src={require(`./images/${icon}.svg`)}/>
    }
    result.push(
        <Collapse.Panel
            header={header}
            key={header}
            forceRender={true}
            extra={extra}
            style={{
                fontSize: "13px",
            }}
        >
            {elements}
        </Collapse.Panel>
    );
    return result;
};

/**
 * Wrap in Collapse
 * @param panels  Collapse.Panel array
 * @returns {Array}
 */
const wrapCollapse = (panels) => {
    const result = [];
    result.push(
        <Collapse key="1" accordion={true} expandIconPlacement="end">
            {panels}
        </Collapse>
    );
    return result;
};

export {renderCategoryChildren, wrapCollapsePanel, wrapCollapse}
