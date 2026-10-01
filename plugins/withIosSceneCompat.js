/** Bridge Expo SDK 54's startup window into the iOS 27 UIScene lifecycle. */
const fs = require('fs');
const path = require('path');
const { withAppDelegate, withInfoPlist, IOSConfig } = require('@expo/config-plugins');

const marker = '// SDK 54 iOS 27 scene bridge';
const oldStartup = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif`;
const newStartup = `${marker}
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
    window?.makeKeyAndVisible()`;

module.exports = function withIosSceneCompat(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [{
          UISceneConfigurationName: 'Default Configuration',
          UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
        }],
      },
    };
    return config;
  });

  config = withAppDelegate(config, (config) => {
    const source = config.modResults.contents;
    if (source.includes(marker)) return config;
    if (!source.includes(oldStartup)) {
      throw new Error('[Mazo] Expo SDK 54 AppDelegate startup template changed; review the iOS scene bridge.');
    }
    config.modResults.contents = source.replace(oldStartup, newStartup);
    return config;
  });

  return IOSConfig.XcodeProjectFile.withBuildSourceFile(config, {
    filePath: 'SceneDelegate.swift',
    contents: fs.readFileSync(path.join(__dirname, 'ios/SceneDelegate.swift'), 'utf8'),
    overwrite: true,
  });
};
