import React from 'react';
import {Menu} from 'antd';
import styles from './styles.css';
import Config from "./Config.jsx";
import Fonts from "./Fonts.jsx";
import {withTranslation} from 'react-i18next';

class Index extends React.Component {
    state = {
        key: "Config"
    };

    actions = {
        changeKey: (e) => {
            this.setState({key: e.key})
        },
    };

    render() {
        const {t} = this.props;
        const state = this.state;
        const {key} = state;
        const actions = this.actions;
        return (
            <div className={styles.div_container}>
                <Menu
                    className={styles.menu}
                    onClick={actions.changeKey}
                    defaultSelectedKeys={[state.key]}
                >
                    <Menu.Item key="Config">{t('Config')}</Menu.Item>
                    <Menu.Item key="Fonts">{t('Fonts')}</Menu.Item>
                </Menu>
                <div className={styles.div_menu_item_container}>
                    {key === 'Config' &&
                    <Config/>
                    }
                    {key === 'Fonts' &&
                    <Fonts/>
                    }
                </div>

            </div>
        )
    }
}

export default withTranslation()(Index);
