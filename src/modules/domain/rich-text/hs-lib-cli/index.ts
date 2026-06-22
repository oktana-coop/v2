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

export type HSLibError = {
  message: string;
};

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
