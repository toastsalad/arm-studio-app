import {App, ConfigProvider, theme as antdTheme} from 'antd';
import React from 'react';
import {connect} from 'react-redux';
import {actions as themeActions} from '../../reducers/theme';
import {THEME_DARK, THEME_TRANSITION_MS, prefersReducedMotion} from '../../utils/theme';
import {refreshCanvasPalette} from '../../utils/canvasPalette';
import {setAntdApis} from '../../utils/antdStatic';
import './styles.css';

// antd surfaces on a dark panel: the panel is --app-panel-bg (#141414), so containers, popups and
// borders are lifted a step so cards still read as raised, the way white cards do in light mode.
//
// These values are a second copy of theme.css - #1f1f1f is both colorBgContainer here and
// --app-surface-bg there - and the two cannot be aliased into one, because antd scopes its
// variables to its own elements: `--app-surface-bg: var(--ant-color-bg-container)` on :root
// resolves to nothing. So each place names the other; change one, change the other.
const DARK_TOKENS = {
    colorBgContainer: '#1f1f1f',
    colorBgElevated: '#262626',
    colorBgLayout: '#141414',
    colorBorder: '#303030',
    colorBorderSecondary: '#2a2a2a',
};

// Hands the theme-aware message/notification/modal instances to plain modules, which is the only
// way they can be themed: the popups render into a portal of their own, outside this tree.
const Bridge = ({children}) => {
    const apis = App.useApp();
    React.useEffect(() => {
        setAntdApis(apis);
    }, [apis]);
    return children;
};

// Wraps the app in antd's theme and mirrors the resolved theme onto <html>, which is where
// theme.css and the canvas palette read it from. Also where the OS is watched for changes.
class Index extends React.Component {
    constructor(props) {
        super(props);
        // Applied here rather than in componentDidMount: a parent's children mount first, and the
        // canvases read the palette while they build their renderer, so the theme has to be on
        // <html> before they are constructed.
        this.apply(props.resolved);
    }

    componentDidMount() {
        this.props.init();
    }

    componentWillUnmount() {
        clearTimeout(this._themeTimer);
    }

    // Runs before the children re-render, so the attribute and the canvas palette are already
    // on the new theme by the time anything reads them.
    UNSAFE_componentWillReceiveProps(nextProps) {
        if (nextProps.resolved !== this.props.resolved) {
            this.apply(nextProps.resolved);
        }
    }

    apply = (resolved) => {
        const root = document.documentElement;
        // Fade the change rather than snapping at it. theme.css transitions the colours while
        // this class is on <html>, and the canvases animate their own clear colour.
        if (root.dataset.theme !== undefined && root.dataset.theme !== resolved && !prefersReducedMotion()) {
            root.classList.add('theme-switching');
            clearTimeout(this._themeTimer);
            this._themeTimer = setTimeout(() => root.classList.remove('theme-switching'), THEME_TRANSITION_MS + 50);
        }
        root.dataset.theme = resolved;
        refreshCanvasPalette();
    };

    render() {
        const dark = this.props.resolved === THEME_DARK;
        return (
            <ConfigProvider theme={{
                // antd v6 writes its tokens as CSS variables, which is what lets its half of the
                // app fade with ours rather than swapping a fresh set of classes.
                algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
                token: dark ? DARK_TOKENS : {},
            }}>
                {/* component={false}: antd's App would otherwise add a wrapper div around the app. */}
                <App component={false}>
                    <Bridge>
                        {this.props.children}
                    </Bridge>
                </App>
            </ConfigProvider>
        );
    }
}

const mapStateToProps = (state) => {
    return {resolved: state.theme.resolved};
};

const mapDispatchToProps = (dispatch) => {
    return {
        init: () => dispatch(themeActions.init()),
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Index);
