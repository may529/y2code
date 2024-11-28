const path = require("path");

module.exports = (env, argv) => {
  return {
    mode: argv.mode || "production",
    entry: "./src/webview/index.tsx",
    output: {
      path: path.resolve(__dirname, "media"),
      filename: "webview.js",
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
    },
  };
};
