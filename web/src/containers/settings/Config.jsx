import React from 'react';
import {withTranslation} from 'react-i18next';
import ConfigSelect from '../../components/Config/ConfigSelect/Index.jsx';
import language from "./lib/language.json";
import {Radio, Switch, Space, Tooltip} from 'antd';
import {actions as persistentDataActions} from "../../reducers/persistentData";
import {actions as themeActions} from "../../reducers/theme";
import {THEME_LIGHT, THEME_DARK, THEME_SYSTEM} from "../../utils/theme";
import {connect} from 'react-redux';

class Config extends React.Component {
    actions = {
        changeLanguage: (lng) => {
            this.props.i18n.changeLanguage(lng);
        },
        toggleIsTooltipDisplayed: (checked) => {
            this.props.setIsTooltipDisplayed(checked)
        },
        toggleAdvance: () => {
            const { advance } = this.props;
            this.props.setAdvance(advance === 0 ? 1 : 0)
        },
        changeTheme: (preference) => {
            this.props.setThemePreference(preference)
        }
    };

    render() {
        const actions = this.actions;
        const {t} = this.props;
        const {isTooltipDisplayed, advance, themePreference} = this.props;
        const languageOptions = [];
        Object.keys(language).forEach((key) => {
            languageOptions.push({value: key, label: language[key]})
        });

        return (
            <div>
                <Space orientation={"vertical"} size={20}>
                    <div>
                        <h3 style={{marginBottom: "3px"}}>{t("Language")}</h3>
                        <ConfigSelect
                            style={{width: "200px"}}
                            value={this.props.i18n.language}
                            onChange={this.actions.changeLanguage}
                            options={languageOptions}/>
                    </div>
                    <div>
                        <h3 style={{marginBottom: "3px"}}>{t("Appearance")}</h3>
                        <Radio.Group
                            value={themePreference}
                            onChange={(e) => actions.changeTheme(e.target.value)}
                            optionType="button"
                            buttonStyle="solid"
                            options={[
                                {value: THEME_LIGHT, label: t('Light')},
                                {value: THEME_DARK, label: t('Dark')},
                                {value: THEME_SYSTEM, label: t('System')},
                            ]}/>
                        <div style={{marginTop: "4px", fontSize: "12px", color: "var(--app-text-muted)"}}>
                            {t('System follows the operating system.')}
                        </div>
                    </div>
                    <div>
                        <h3 style={{marginBottom: "3px"}}>{t("Show Tooltip")}</h3>
                        <Switch
                            style={{}}
                            checked={isTooltipDisplayed}
                            onChange={actions.toggleIsTooltipDisplayed}/>
                    </div>
                    <div>
                        <h3 style={{marginBottom: "3px"}}>{t("Advance")}</h3>
                        <Tooltip 
                            placement="topLeft" 
                            title={t("The advanced mode is designed for drawing and engraving on Sliding Rail. It will cancel the workspace limitation of Drawing and Laser. It will also change X-axis movements to E-axis movements. Do not set the picture width over the Sliding Rail's 1000mm working range.")}>
                            <Switch
                                style={{}}
                                checked={advance === 1}
                                onChange={actions.toggleAdvance}
                            />
                        </Tooltip>
                    </div>
                </Space>
            </div>
        )
    }
}

const mapStateToProps = (state) => {
    const {isTooltipDisplayed, advance} = state.persistentData;
    const {preference: themePreference} = state.theme;
    return {
        isTooltipDisplayed,
        advance,
        themePreference
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        setIsTooltipDisplayed: (value) => dispatch(persistentDataActions.setIsTooltipDisplayed(value)),
        setAdvance: (value) => dispatch(persistentDataActions.setAdvance(value)),
        setThemePreference: (preference) => dispatch(themeActions.setPreference(preference))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation()(Config));



