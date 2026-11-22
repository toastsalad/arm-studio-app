const path = require('path');

const i18nPackages = /node_modules[\\/](i18next|react-i18next|i18next-http-backend|i18next-browser-languagedetector)[\\/]/;

module.exports = {
    mode: 'production',
    entry: "./src/index.jsx",
    output: {
        path: __dirname + "/build-web",
        filename: "bundle.js"
    },
    resolve: {
        extensions: ['.js', '.jsx', '.json']
    },
    module: {
        rules: [
            {
                // react-draggable's .mjs imports 'process/browser' without an
                // extension; relax webpack 5's fully-specified requirement.
                test: /\.m?js$/,
                resolve: { fullySpecified: false }
            },
            {
                test: /\.(js|jsx|mjs)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        cacheDirectory: true
                    }
                }
            },
            {
                // The i18next stack ships modern ESM that babel must transpile
                // (babel ignores node_modules by default).
                test: /\.m?js$/,
                include: i18nPackages,
                use: {
                    loader: 'babel-loader',
                    options: {
                        babelrc: false,
                        configFile: false,
                        cacheDirectory: true,
                        presets: [['@babel/preset-env', { modules: false }]]
                    }
                }
            },
            {
                test: /\.(css|less)$/,
                include: /node_modules/,
                use: [{loader: 'style-loader'}, {loader: 'css-loader'}],
            },
            {
                test: /\.(css|less)$/,
                exclude: /node_modules/,
                use: [{
                    loader: 'style-loader'
                }, {
                    loader: 'css-loader',
                    options: {
                        modules: {
                            localIdentName: '[path][name]__[local]--[hash:base64:5]',
                            namedExport: false,
                            exportLocalsConvention: 'as-is',
                        },
                    }
                }],
            },
            {
                test: /\.(gif|png|jpg|ico|svg)$/,
                type: 'asset',
                parser: {dataUrlCondition: {maxSize: 100000}},
                generator: {filename: './asset/image/[hash][ext][query]'}
            }
        ]
    },
    devServer: {
        port: 8080,
        compress: true,
        open: false,
        hot: true,
        static: path.join(__dirname, "build-web")
    }
};
