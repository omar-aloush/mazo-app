/** Xcode 27 rejects pod targets whose deployment targets are below iOS 15. */
const { withPodfile } = require('@expo/config-plugins');

const MARKER = '# Mazo: keep pod targets compatible with Xcode 27';

module.exports = function withIosPodMinimum(config) {
  return withPodfile(config, (config) => {
    const source = config.modResults.contents;
    if (source.includes(MARKER)) return config;

    const anchor = '      :ccache_enabled => ccache_enabled?(podfile_properties),\n    )';
    if (!source.includes(anchor)) {
      throw new Error('[Mazo] Could not find the React Native post_install hook in Podfile.');
    }

    config.modResults.contents = source.replace(anchor, `${anchor}

    ${MARKER}
    installer.pods_project.targets.each do |pod_target|
      pod_target.build_configurations.each do |build_configuration|
        current = build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || Gem::Version.new(current) < Gem::Version.new('15.1')
          build_configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
        end
      end
    end`);
    return config;
  });
};
