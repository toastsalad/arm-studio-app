import React from 'react';

// Field label used inside a config/control panel, next to a control.
const Index = (props) => {
    return (
        <span
            className={props.className}
            style={{
                fontSize: "12px",
                lineHeight: "1.4",
                color: "var(--app-text-secondary)",
                ...props.style
            }}>
            {props.text}
        </span>
    );
};

export default Index;
