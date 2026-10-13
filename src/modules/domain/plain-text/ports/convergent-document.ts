import {
  type ConvergentDocument,
  type ConvergentDocumentState,
} from '../../collaboration';
import { type ParticipantSelection, type PlainTextDocument } from '../models';

export type PlainTextConvergentDocumentState =
  ConvergentDocumentState<PlainTextDocument>;

export type PlainTextConvergentDocument = ConvergentDocument<
  PlainTextDocument,
  ParticipantSelection
>;
