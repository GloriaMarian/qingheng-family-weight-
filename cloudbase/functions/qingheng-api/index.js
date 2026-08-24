/* eslint-disable @typescript-eslint/no-require-imports */
const serverless = require("serverless-http");
const { app, configureCloudbase } = require("./server.cjs");

const handler = serverless(app, {
  request(request, event) {
    request.url = event.path || request.url;
  },
});

exports.main = async (event, context) => {
  configureCloudbase(context);
  return handler(event, context);
};
