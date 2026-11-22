import React, {PureComponent} from 'react';
import {Slider, InputNumber} from 'antd';
import styles from './styles.css';

// Numeric setting: a slider with a tiny centred box beside it.
//
// The slider only spans [min, max]. A value typed into the box is NOT clamped to that range - the
// tool may well accept more than the slider can reach - so when it falls outside, the thumb parks
// at the nearer end and the box keeps what was typed.
//
// Pass slider={false} for a field with no usable range (an unbounded maximum, say); it then
// renders the box alone, still right-aligned in the control half.
class Index extends PureComponent {
    state = {value: this.props.value};

    componentDidUpdate(prev) {
        if (prev.value !== this.props.value && this.props.value !== this.state.value) {
            this.setState({value: this.props.value});
        }
    }

    hasRange() {
        const {min, max, slider} = this.props;
        return slider !== false && Number.isFinite(min) && Number.isFinite(max) && max > min;
    }

    commit(value) {
        if (!Number.isFinite(value) || value === this.props.value) return;
        this.props.onChange(value);
    }

    actions = {
        // Drag: track the thumb, but only hit the store on release. Every settings change kicks
        // off a preview, so committing mid-drag would queue one per pixel.
        onSlide: (value) => this.setState({value}),
        onSlideDone: (value) => this.commit(value),
        onType: (value) => this.setState({value}),
        onSubmit: () => {
            // Empty or a lone "-": put back the value we came in with.
            if (!Number.isFinite(this.state.value)) this.setState({value: this.props.value});
            else this.commit(this.state.value);
        },
        onKeyUp: (e) => {
            if (e.keyCode === 13) e.target.blur();
        },
    };

    render() {
        const {min, max, precision = 0, disabled} = this.props;
        const {value} = this.state;
        const hasRange = this.hasRange();
        // Number.isFinite keeps a null/NaN box value from reaching the slider.
        const current = Number.isFinite(value) ? value : this.props.value;
        const sliderValue = hasRange ? Math.min(Math.max(current, min), max) : min;

        return (
            <div className={styles.row}>
                {hasRange && (
                    <div className={styles.slider}>
                        <Slider
                            min={min}
                            max={max}
                            step={1 / Math.pow(10, precision)}
                            value={sliderValue}
                            onChange={this.actions.onSlide}
                            onChangeComplete={this.actions.onSlideDone}
                            disabled={disabled}/>
                    </div>
                )}
                <InputNumber
                    className={styles.box}
                    size="small"
                    controls={false}
                    step={1 / Math.pow(10, precision)}
                    precision={precision}
                    value={Number.isFinite(value) ? value : null}
                    onChange={this.actions.onType}
                    onBlur={this.actions.onSubmit}
                    onKeyUp={this.actions.onKeyUp}
                    disabled={disabled}/>
            </div>
        );
    }
}

export default Index;
