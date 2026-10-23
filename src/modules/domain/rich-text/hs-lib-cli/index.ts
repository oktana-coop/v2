import { RichTextRepresentation, richTextRepresentations } from '../models';

export const representationToCliArg = (
  representation: RichTextRepresentation
): string => {
  switch (representation) {
    case richTextRepresentations.AUTOMERGE:
      return 'automerge';
    case richTextRepresentations.MARKDOWN:
      return 'markdown';
    case richTextRepresentations.HTML:
      return 'html';
    case richTextRepresentations.PROSEMIRROR:
      return 'prosemirror';
    case richTextRepresentations.DOCX:
      return 'docx';
    case richTextRepresentations.PANDOC:
    default:
      return 'pandoc';
  }
};

export type HSLibReadError = {
  type: 'readError';
  message: string;
};

export type HSLibInvalidMetadataError = {
  type: 'invalidMetadataError';
  message: string;
};

export type HSLibWriteError = {
  type: 'writeError';
  message: string;
};

export type HSLibPatchError = {
  type: 'patchError';
  message: string;
};

export type HSLibError =
  | HSLibReadError
  | HSLibInvalidMetadataError
  | HSLibWriteError
  | HSLibPatchError;

export type HSLibSuccessOutput<T> = {
  data: T;
};

export type HSLibFailureOutput = {
  errors: HSLibError[];
};

export type HSLibOutput<T> = HSLibSuccessOutput<T> | HSLibFailureOutput;

export const isHSLibFailureOutput = <T>(
  output: HSLibOutput<T>
): output is HSLibFailureOutput => {
  return 'errors' in output;
};

export const isHSLibInvalidMetadataError = (
  error: HSLibError
): error is HSLibInvalidMetadataError => error.type === 'invalidMetadataError';

export const joinHSLibErrorMessages = (errors: HSLibError[]): string =>
  errors.map((error) => error.message).join(', ');
