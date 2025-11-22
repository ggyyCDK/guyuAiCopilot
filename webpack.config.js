'use strict';

const path = require('path');

const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const merge = require('webpack-merge').default;
const CopyPlugin = require('copy-webpack-plugin');
const isProduction = process.argv.includes('production');
const commonConfig = {
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      'express-handlebars': 'handlebars/dist/handlebars.js',
    },
  },
  plugins: [new ForkTsCheckerWebpackPlugin()],
};

/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const configForWebview = merge(commonConfig, {
  mode: 'development',
  entry: {
    sidebar: path.resolve(__dirname, './src/Webview/index.tsx'),
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.(svg|png|jpg|gif)$/i,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 1024 * 1024,
            },
          },
        ],
      },
      {
        test: /\.(js|jsx|tsx|ts)$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
      },
      // CSS Modules - .module.css
      {
        test: /\.module\.scss$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: '[name]__[local]--[hash:base64:5]',
              },
              importLoaders: 1, // ✅ 重要：告诉 css-loader 有 1 个 loader 在它之前
            },
          },
          'sass-loader',
        ],
      },
      {
        test: /\.scss$/,
        exclude: /\.module\.scss$/, // ✅ 排除 module.scss
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
            },
          },
          'sass-loader',
        ],
      },
      // 普通 CSS 文件
      {
        test: /\.css$/,
        exclude: /\.module\.css$/,
        use: ['style-loader', 'css-loader'],
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: 'src/index.html',
          to: 'index.html',
          toType: 'file',
        },
      ],
    }),
  ],
  devtool: isProduction ? false : 'inline-source-map',
  // ✅ Watch 配置
  ...(isProduction ? {} : {
    watch: true,
    watchOptions: {
      aggregateTimeout: 300,
      poll: 1000,
      ignored: ['**/node_modules', '**/dist'],
    },
  }),
  // ✅ 缓存配置（加速编译）
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  },
  // ✅ 性能提示
  performance: {
    hints: false,
  },
});

/** @type WebpackConfig */
const extensionConfig = merge(commonConfig, {
  ...commonConfig,
  target: 'node',
  mode: 'none',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
  },
  externals: {
    vscode: 'commonjs vscode',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|tsx|ts)$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
      },
    ],
  },
  devtool: 'nosources-source-map',
});

module.exports = [extensionConfig, configForWebview];
