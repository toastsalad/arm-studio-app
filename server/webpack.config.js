const path = require("path")
const fs = require("fs");

const nodeModules = {};
function add(name) { nodeModules[name] = "commonjs " + name; }
for (const entry of fs.readdirSync('./node_modules')) {
    if (entry[0] === '.') continue;
    if (entry[0] === '@') {
        const scopeDir = './node_modules/' + entry;
        if (fs.statSync(scopeDir).isDirectory()) {
            for (const sub of fs.readdirSync(scopeDir)) add(entry + '/' + sub);
        }
    } else {
        add(entry);
    }
}
// electron is provided by the host at runtime (not a node_module dependency).
nodeModules['electron'] = 'commonjs electron';

module.exports = {
    entry: {
        startLocalServer: './src/index.js',
        rasterWorker: './src/toolPath/rasterWorker.js',
    },
    target: 'node',
    node: { __dirname: false, __filename: false },
    output: {
        path: path.resolve(__dirname, "build-server"),
        filename: "[name].js",
        libraryTarget: "commonjs"
    },
    externals: nodeModules
};
