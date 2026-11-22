import React, {PureComponent} from 'react';
import {Select} from 'antd';

class Index extends PureComponent {
    render() {
        const {value, options, onChange, ...rest} = this.props;
        // The options prop rather than Select.Option children, which antd v5+ asks against; the
        // per-item colour rides on the option itself.
        const selectOptions = options.map(item => ({
            value: item.value,
            label: item.label,
            style: item.color ? {fontSize: "12px", color: item.color} : {fontSize: "12px"},
        }));
        return (
            <Select
                size="small"
                value={value}
                onChange={onChange}
                style={{width: "100%", fontSize: "12px"}}
                options={selectOptions}
                {...rest}
            />
        );
    }
}

export default Index;
