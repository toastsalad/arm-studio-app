import React from 'react';
import {createRoot} from 'react-dom/client';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import {initReactI18next} from 'react-i18next'
import Index from './containers/Index.jsx';
import {createStore, applyMiddleware} from 'redux';
import {Provider} from 'react-redux';
import {thunk} from 'redux-thunk';
import reducer from './reducers';
import i18next from 'i18next'
import language from './containers/settings/lib/language.json'
import "antd/dist/reset.css";
import './global_styles.css';
import './theme.css';
import AppTheme from './components/AppTheme/Index.jsx';

// A file dropped outside a canvas would otherwise make the app navigate to it.
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());

const i18nOptions = {
    backend: {
        /* translation file path */
        loadPath: './asset/i18n/{{ns}}/{{lng}}.json'
    },
    /**
     * Array of allowed languages
     * @default false
     */
    supportedLngs: Object.keys(language),
    /**
     * Language codes to lookup, given set language is
     * 'en-US': 'all' --> ['en-US', 'en', 'dev'],
     * 'currentOnly' --> 'en-US',
     * 'languageOnly' --> 'en'
     * @default 'all'
     */
    load: 'currentOnly',
    fallbackLng: 'en',
    debug: false,
    ns: ['common', 'cura'],
    defaultNS: 'common',
    keySeparator: false,
    nsSeparator: "#",
    interpolation: {
        escapeValue: false,
        formatSeparator: ','
    },
    react: {
        useSuspense: false,
        wait: true
    }
};

i18next
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init(i18nOptions)
    .then(
        (t) => {
            const reduxStore = createStore(reducer, applyMiddleware(thunk));
            createRoot(document.getElementById('content')).render(
                <Provider store={reduxStore}>
                    <AppTheme>
                        <Index/>
                    </AppTheme>
                </Provider>
            );
        }
    );
