import * as Effect from 'effect/Effect';
import { z } from 'zod';

import { ValidationError } from './errors';

// eslint-disable-next-line no-control-regex
const RESERVED_CHARACTERS = /[<>:"|?*\x00-\x1f]/;

// Windows reads the superscripts ¹ ² ³ as port numbers.
const WINDOWS_DEVICE_NAMES =
  /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]|conin\$|conout\$)$/i;

// Windows 10 and earlier cut a name at its first dot, drop trailing spaces and
// compare what is left with the device names, ignoring case: `con.md`,
// `CON .txt` and `con.tar.gz` all open the CON device.
const deviceNameOf = (name: string): string =>
  name.split('.')[0].replace(/ +$/, '');

// ext4 allows 255 bytes, APFS 255 characters and NTFS 255 UTF-16 code units.
// A name never has fewer UTF-8 bytes than characters or code units, so 255
// UTF-8 bytes fits all three.
const MAX_UTF8_BYTES = 255;

const textEncoder = new TextEncoder();

// Names that macOS, Linux and Windows all accept, so a folder stays usable
// when it is copied or cloned to another OS.
export const entryNameSchema = z
  .string()
  // The same visible name can be encoded in more than one way; NFC gives each
  // name a single encoding.
  .normalize('NFC')
  .min(1, 'Enter a name')
  .refine((name) => !/[/\\]/.test(name), 'A name cannot contain / or \\')
  .refine(
    (name) => name !== '.' && name !== '..',
    '"." and ".." cannot be used as names'
  )
  .refine(
    (name) => !RESERVED_CHARACTERS.test(name),
    'A name cannot contain < > : " | ? * or control characters'
  )
  .refine(
    (name) => !/[. ]$/.test(name),
    'A name cannot end with a dot or a space'
  )
  .refine(
    (name) => !WINDOWS_DEVICE_NAMES.test(deviceNameOf(name)),
    'This name is reserved on Windows'
  )
  .refine(
    (name) => textEncoder.encode(name).length <= MAX_UTF8_BYTES,
    'This name is too long'
  );

export const parseEntryNameEffect = (
  name: string
): Effect.Effect<string, ValidationError, never> => {
  const result = entryNameSchema.safeParse(name);

  return result.success
    ? Effect.succeed(result.data)
    : Effect.fail(new ValidationError(result.error.issues[0].message));
};
