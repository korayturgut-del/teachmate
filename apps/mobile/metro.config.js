const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro yapılandırması
 * https://reactnative.dev/docs/metro
 */
const config = {};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
