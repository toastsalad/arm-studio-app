import React, {PureComponent} from 'react';
import { Button, Tooltip } from 'antd';
import styles from './styles.css';

class Index extends PureComponent {
    render() {
        const {text = "", onClick, className, ...rest} = this.props;
        return (
            <Tooltip placement="top" title={text}>
                <Button
                    block
                    size="middle"
                    className={`${styles.style_default}${className ? ' ' + className : ''}`}
                    {...rest}
                    onClick={onClick}>
                    {text}
                </Button>
            </Tooltip>
        );
    }
}

export default Index;
