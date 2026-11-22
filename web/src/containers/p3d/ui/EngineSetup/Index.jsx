import React from 'react';
import {Alert, Button, Progress} from 'antd';
import {connect} from 'react-redux';
import {withTranslation} from 'react-i18next';
import {actions as p3dEngineActions} from "../../../../reducers/p3dEngine";

// CuraEngine is AGPL-3.0, so it is not shipped with this app: on first use of 3D printing the user
// is offered Ultimaker's own release, downloaded into their user data dir. Nothing is fetched until
// they click Download, and the rest of the app (laser, pen plotting) never touches this.
//
// Rendered instead of the slicing panel while the engine is missing or being fetched, so the
// "Slice Model" button cannot be pressed with no engine behind it.
const formatSize = (bytes) => `${Math.round(bytes / (1024 * 1024))} MB`;

class Index extends React.Component {
    componentDidMount() {
        // The server pushes status on connect, but the panel can mount after that.
        this.props.refresh();
    }

    render() {
        const {t, status} = this.props;
        if (!status) return null;
        if (status.state === 'ready') return null;

        const downloadPage = status.downloadPage;

        if (status.state === 'downloading') {
            return (
                <Alert
                    type="info"
                    showIcon
                    message={t("Downloading CuraEngine")}
                    description={
                        <div>
                            <Progress percent={Math.round((status.progress || 0) * 100)} size="small"/>
                            <span>
                                {formatSize(status.received || 0)} / {formatSize(status.total || 0)}
                            </span>
                        </div>
                    }
                />
            );
        }

        const unsupported = !status.platformSupported;
        const description = unsupported ? (
            <span>
                {t("Automatic download is not available on this platform. Install CuraEngine manually from")}{' '}
                <a href={downloadPage} target="_blank" rel="noreferrer">{downloadPage}</a>.
            </span>
        ) : (
            <span>
                {t("3D printing needs CuraEngine, which this app does not ship. It is downloaded from Ultimaker's release page into your user data folder (about")}{' '}
                {formatSize(status.downloadBytes)}.
                {status.error ? <><br/><strong>{status.error}</strong></> : null}
                <br/>
                <a href={downloadPage} target="_blank" rel="noreferrer">{t("Download page")}</a>
            </span>
        );

        return (
            <Alert
                type={status.state === 'error' ? 'error' : 'warning'}
                showIcon
                message={t("CuraEngine is not installed")}
                description={
                    <div>
                        {description}
                        {!unsupported &&
                            <Button
                                size="small"
                                type="primary"
                                style={{marginTop: "8px"}}
                                onClick={this.props.install}>
                                {t("Download CuraEngine")}
                            </Button>
                        }
                    </div>
                }
            />
        );
    }
}

const mapStateToProps = (state) => ({status: state.p3dEngine.status});

const mapDispatchToProps = (dispatch) => ({
    install: () => dispatch(p3dEngineActions.install()),
    refresh: () => dispatch(p3dEngineActions.refresh()),
});

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(Index));
