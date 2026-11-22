import React from 'react';
import {uploadFile} from "../../../../api";
import {actions as p3dModelActions} from "../../../../reducers/p3dModel";
import {connect} from 'react-redux';
import {withTranslation} from 'react-i18next';
import ActionButton from '../../../../components/ActionButton/Index.jsx';

class Index extends React.Component {
    fileInput = React.createRef();

    actions = {
        uploadFile: async (event) => {
            const file = event.target.files[0];
            const response = await uploadFile(file);
            const {url} = response;
            this.props.loadModel(url)
        },
        onClickUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        }
    };

    render() {
        const actions = this.actions;
        const {t} = this.props;
        return (
            <div>
                <input
                    ref={this.fileInput}
                    type="file"
                    accept={'.stl'}
                    style={{display: 'none'}}
                    multiple={false}
                    onChange={actions.uploadFile}
                />
                <ActionButton onClick={actions.onClickUpload} text={t("Import Model")}/>
            </div>
        )
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        loadModel: (url) => dispatch(p3dModelActions.loadModel(url)),
    };
};

export default connect(null, mapDispatchToProps)(withTranslation()(Index));


