import React from 'react';
import {Tooltip} from 'antd';
import styles from './styles.css';

// Sends the job that has just been generated, so it sits beside whatever generates it. Green
// because it starts something, and it is only rendered once there is G-code to send.
const Index = ({title, onClick}) => (
    <Tooltip placement="top" title={title}>
        <button className={styles.btn_play} onClick={onClick}/>
    </Tooltip>
);

export default Index;
