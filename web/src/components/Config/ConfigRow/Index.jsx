import React from 'react';
import {Row, Col, Tooltip} from 'antd';
import ConfigText from '../ConfigText/Index.jsx';

// One settings row: the label owns the left half, the control the right half. Labels start at the
// panel edge - no column offset - so every panel lines up the same way.
//
// The unit belongs to the value, not the label, so a row takes it as `unit` and the tooltip grows
// " (mm)" instead. Labels then read the same width with or without one.
//
// indent marks a child of the setting above it (Multi-Pass and its passes), which keeps a two
// column step so the grouping still reads. The spans shrink to make room for the offset.
//
// Two tooltip styles are in use. Panels that render a shared react-tooltip instance pass its id
// and the row is anchored with data attributes; the rest pass only the text and get an antd
// tooltip wrapped around the row.
const Index = ({label, unit, tooltip, tooltipId, indent = false, children, ...rest}) => {
    const tip = unit ? `${tooltip || label} (${unit})` : tooltip;
    const rowProps = {...rest};
    if (tip && tooltipId) {
        rowProps['data-tooltip-id'] = tooltipId;
        rowProps['data-tooltip-content'] = tip;
    }
    // One height for every row. Rows are as tall as the tallest control otherwise, and a slider
    // control is taller than a checkbox, which left the gap above a numeric setting wider than the
    // gap above a checkbox. The sliders are trimmed to fit (see ConfigNumber/styles.css).
    rowProps.style = {height: '28px', marginBottom: '4px', ...(rest.style || {})};
    const labelCol = indent ? {span: 10, offset: 2} : {span: 12};
    const row = (
        <Row align="middle" {...rowProps}>
            <Col {...labelCol}><ConfigText text={label}/></Col>
            <Col span={12}>{children}</Col>
        </Row>
    );
    if (tip && !tooltipId) {
        return <Tooltip title={tip} placement="left" mouseEnterDelay={0.25}>{row}</Tooltip>;
    }
    return row;
};

export default Index;
