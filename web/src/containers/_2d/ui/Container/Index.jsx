import React from 'react';
import {Tabs} from 'antd';
import {connect} from 'react-redux';
import ToolBarI18n from '../../../ToolBarI18n/Index.jsx';
import {withTranslation} from 'react-i18next';
import layout_styles from '../../../layout_styles.css';
import {actions as viewOptionActions} from '../../../../reducers/viewOptions';

const {TabPane} = Tabs;

// Shell shared by the laser and write & draw 2D tabs: canvas, toolbar and the config / control
// tabs. The caller supplies the canvas and panels so each tab keeps its own model.
class TwoDContainer extends React.Component {
    render() {
        const {t, Canvas, Config, Control, model, modelCount, showTravel, toggleTravel} = this.props;
        const operations = {
            undo: () => this.props.undo(),
            redo: () => this.props.redo(),
            duplicate: () => this.props.duplicateSelected(),
            del: () => this.props.removeSelected(),
            clear: () => this.props.removeAll(),
            toggleTravel: () => toggleTravel()
        };
        const enabledInfo = {duplicate: !!model, del: !!model, clear: (modelCount > 0), toggleTravel: true};
        const visibleInfo = {undo: false, redo: false, layFlat: false, duplicate: false, del: true, clear: true, toggleTravel: true};
        return (
            <div>
                <div className={layout_styles.div_canvas}>
                    <Canvas/>
                </div>
                <div className={layout_styles.div_tool_bar}>
                    <ToolBarI18n operations={operations} enabledInfo={enabledInfo} visibleInfo={visibleInfo}
                                 showTravel={showTravel}/>
                </div>
                <div className={layout_styles.div_right_panel}>
                    <Tabs centered={true} size="small">
                        <TabPane tab={t('G-code')} key="1">
                            <Config/>
                        </TabPane>
                        <TabPane tab={t('Control Panel')} key="2">
                            <Control/>
                        </TabPane>
                    </Tabs>
                </div>
            </div>
        )
    }
}

export default withTranslation()(connect(
    (state) => ({showTravel: state.viewOptions.showTravel}),
    (dispatch) => ({toggleTravel: () => dispatch(viewOptionActions.toggleTravel())})
)(TwoDContainer));
