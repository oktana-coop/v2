import {
  type ConvergentDocument,
  type ConvergentDocumentState,
} from '../../collaboration';
import {
  type ParticipantSelection,
  type PrimaryRichTextDocument,
} from '../models';

export type RichTextConvergentDocumentState =
  ConvergentDocumentState<PrimaryRichTextDocument>;

export type RichTextConvergentDocument = ConvergentDocument<
  PrimaryRichTextDocument,
  ParticipantSelection
>;
