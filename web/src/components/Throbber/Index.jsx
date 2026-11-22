import React, {PureComponent} from 'react';
import {Spin} from 'antd';
import styles from './styles.css';

// The one busy indicator in the app.
//
// Two shapes, so a button or a dropdown can use the same spinner without a floating badge:
// the badge (default) over whatever is working, or `inline` for use inside another control.
//
// It waits before appearing, so an operation that finishes quickly does not flash it. The default
// is the half second the toolpath previews use; pass delay={0} where the wait is already known to
// be long.
class Index extends PureComponent {
    state = {shown: false};
    timer = null;

    componentDidMount() {
        this.sync();
    }

    componentDidUpdate(prev) {
        if (prev.visible !== this.props.visible) this.sync();
    }

    componentWillUnmount() {
        clearTimeout(this.timer);
    }

    sync() {
        clearTimeout(this.timer);
        this.timer = null;
        if (!this.props.visible) {
            if (this.state.shown) this.setState({shown: false});
            return;
        }
        const delay = this.props.delay === undefined ? 500 : this.props.delay;
        if (delay <= 0) {
            this.setState({shown: true});
            return;
        }
        this.timer = setTimeout(() => this.setState({shown: true}), delay);
    }

    render() {
        const {visible, inline, size = "small", nodeRef, className, style} = this.props;
        const shown = visible && this.state.shown;
        // A button or dropdown renders the bare spinner; anything floating over content gets the
        // badge, which stays mounted while hidden so callers can hold a ref to it and move it.
        if (inline) return shown ? <Spin size={size}/> : null;
        return (
            <div
                ref={nodeRef}
                className={className ? `${styles.badge} ${className}` : styles.badge}
                style={{display: shown ? "flex" : "none", ...style}}>
                <Spin size={size}/>
            </div>
        );
    }
}

export default Index;
