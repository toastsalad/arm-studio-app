import React from 'react';
import ToolBar from '../ToolBar/Index.jsx';
import {withTranslation} from 'react-i18next';

class Index extends React.Component {
    render() {
        const {t} = this.props;
        const {...rest} = this.props;
        const tipInfo = {
            exportModels: t("export models"),
            undo: t("undo"),
            redo: t("redo"),
            layFlat: t("lay flat"),
            duplicate: t("duplicate"),
            del: t("delete"),
            clear: t("clear"),
            // Names the state you are in, not the one the button moves you to.
            toggleTravel: rest.showTravel === false ? t("show travel moves") : t("hide travel moves"),
        };
        const clearPopConfirmInfo = {
            cancelText: t("NO"),
            okText: t("OK"),
            // "Are you sure?" said nothing about what would go, and the bubble appears over the drawing rather
            // than beside a list, so it read as a stray tooltip. Name the whole canvas.
            title: t("Clear all drawings?"),
            description: t("Everything on the canvas will be removed."),
        };
        return (
            <ToolBar
                {...rest}
                tipInfo={tipInfo}
                clearPopConfirmInfo={clearPopConfirmInfo}
            />
        )
    }
}

export default withTranslation()(Index);

