import React from 'react';
import {Tabs} from 'antd';
import Canvas2D from '../writeAndDraw/ui/Canvas2D/Index.jsx';
import Gcode from './ui/Gcode/Index.jsx';
import Control from './ui/Control/Index.jsx';
import {withTranslation} from 'react-i18next';
import layout_styles from '../layout_styles.css';

const {TabPane} = Tabs;

class Index extends React.Component {

    render() {
        const {model, modelCount} = this.props;
        const {t} = this.props;
        const operations = this.operations;
        return (
            <div>
                <div className={layout_styles.div_canvas}>
                    <Canvas2D isBasic={true} />
                </div>
                <div style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    right: "375px",
                    width: "35px",
                    height: "100%",
                    border: "1px solid var(--app-border)",
                    borderTopWidth: 0,
                    borderBottomWidth: 0,
                    backgroundColor: "var(--app-subtle-bg)"
                }}/>
                <div className={layout_styles.div_right_panel}>
                    <Tabs centered={true} size="small">
                        <TabPane tab={t('Control Panel')} key="1">
                            <Control/>
                        </TabPane>
                        <TabPane tab={t('G-code')} key="2">
                            <Gcode/>
                        </TabPane>
                    </Tabs>
                </div>
            </div>
        )
    }
}

export default withTranslation()(Index);







