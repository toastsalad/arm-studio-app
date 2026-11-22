import React from 'react';

// Section heading. Kept explicit (not an <h4>) so it does not inherit the
// browser heading margin/weight, which varied from panel to panel.
const Index = (props) => {
    return (
        <div
            className={props.className}
            style={{
                fontSize: "12px",
                fontWeight: 600,
                lineHeight: "1.4",
                color: "var(--app-text)",
                margin: "0 0 8px 0",
                ...props.style
            }}>
            {props.text}
        </div>
    );
};

export default Index;
