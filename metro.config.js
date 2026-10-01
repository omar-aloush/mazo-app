const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.watchFolders = [__dirname];

config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    // An unsigned iOS simulator cannot read Expo's push-token Keychain state.
    // The opt-in scripted demo uses local notifications, not server push.
    if (process.env.EXPO_PUBLIC_DEMO_MODE === '1' && platform === 'ios' &&
      context.originModulePath.includes('expo-notifications') &&
      moduleName === './DevicePushTokenAutoRegistration.fx') {
      return { type: 'sourceFile', filePath: path.join(__dirname, 'services/demoPushRegistration.ts') };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
  blockList: [
    /node_modules\/.*\/android\/.*/,
    /node_modules\/.*\/ios\/.*/,
    /node_modules\/@react-native\/debugger-frontend\/.*/,
    /node_modules\/@react-native\/gradle-plugin\/.*/,
    /node_modules\/@react-native\/codegen\/node_modules\/.*/,
  ],
};

config.watcher = {
  ...config.watcher,
  additionalExts: [],
};

config.server = {
  ...config.server,
  port: 5000,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
