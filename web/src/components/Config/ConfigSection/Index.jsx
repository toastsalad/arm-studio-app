import React from 'react';
import {Collapse} from 'antd';
import styles from './styles.css';

// One collapsible block of a settings panel. A panel stacks several of these and they all start
// closed, so it reads as a list of headings until you open the one you want.
const Index = ({title, children}) => (
    <Collapse
        className={styles.section}
        expandIconPlacement="end"
        items={[{
            key: 'section',
            label: title,
            children: <div className={styles.body}>{children}</div>,
        }]}/>
);

export default Index;
