const path = require('path')

module.exports = {
    target: 'node',
    context: __dirname,
    entry: './src/index.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'index.js',
        libraryTarget: 'commonjs2',
    },
    resolve: {
        extensions: ['.ts', '.js', '.json'],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: 'ts-loader',
                options: {
                    configFile: path.resolve(__dirname, 'tsconfig.json'),
                },
            },
            {
                test: /\.html$/,
                type: 'asset/source',
            },
            {
                test: /\.css$/,
                type: 'asset/source',
            },
        ],
    },
    externals: [
        'fs',
        'path',
        'os',
        'crypto',
        'net',
        'stream',
        'readline',
        'electron',
        /^rxjs/,
        /^@angular/,
        /^tabby-/,
    ],
    devtool: 'source-map',
}
