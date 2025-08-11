import '@testing-library/jest-dom';

// Adding these to the global object were required for
// storybook-addon-remix-react-router to run properly after React Router v7 updgrade (its version was update from v3 to v4)
import { TextDecoder, TextEncoder } from 'node:util';

if (typeof global.TextEncoder === 'undefined') {
  // @ts-expect-error TextEncoder type mismatch
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  // @ts-expect-error TextDecoder type mismatch
  global.TextDecoder = TextDecoder;
}
