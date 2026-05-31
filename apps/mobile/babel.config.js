module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // react-native-vision-camera v4 için worklets plugin (frame processor desteği)
    // İleride OCR frame processor eklenecekse zorunlu
    [
      'react-native-worklets-core/plugin',
      {
        processNestedWorklets: true,
      },
    ],
  ],
};
