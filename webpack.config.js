const path = require('path');
module.exports = {
    mode: 'development',
    devtool: 'eval-source-map',
    entry: './index.js',
    experiments: {
        topLevelAwait: true
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
        publicPath: "/Talks-Web-2.0/",
    },
    watch: true,
    resolve: {
        fallback: {
          "util": false,
          "path": false,
          "crypto": false,
          "zlib": false,
          "stream": false,
          "buffer": false,
          "https": false,
          "http": false,
          "url": false,
          "vm": false,
          "querystring": false,
          "os": false,
          "assert": false,
          "constants": false,
          "fs": false,
          "module": false,
          "esbuild": false,
          "uglify-js": false,
          "worker_threads": false,
          "child_process": false,
          "inspector": false,
          "@swc/core":false
        } 
      },
};
