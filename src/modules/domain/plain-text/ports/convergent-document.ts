import {
  type ConvergentDocument,
  type ConvergentDocumentState,
} from '../../collaboration';
import {
  type PlainTextDocument,
  type PlainTextParticipantSelection,
} from '../models';

export type PlainTextConvergentDocumentState =
  ConvergentDocumentState<PlainTextDocument>;

export type PlainTextConvergentDocument = ConvergentDocument<
  PlainTextDocument,
  PlainTextParticipantSelection
>;
