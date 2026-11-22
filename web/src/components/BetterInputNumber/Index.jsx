import React from 'react';
import { InputNumber } from 'antd';
import styles from './styles.css';

export default class BetterInputNumber extends React.Component {
  render() {
    if (this.props.suffix) {
      return (
        <>
          <InputNumber 
            className={styles.centered}
            style={{
              verticalAlign: 'middle', 
              borderBottomRightRadius: 0, 
              borderTopRightRadius: 0
            }} 
            {...this.props}
          />
          <div 
            className="ant-input-group-addon" 
            style={{
              verticalAlign:'middle', 
              display:'inline-table', 
              height:'22px',
            }}>
              {this.props.suffix}
            </div>
        </>
      );
    } else {
      return (
          <InputNumber className={styles.centered} {...this.props}/>
      );
    }
  }
}