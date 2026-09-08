import { type Node } from 'prosemirror-model';
import {
  AddMarkStep,
  AttrStep,
  RemoveMarkStep,
  ReplaceStep,
} from 'prosemirror-transform';
import { describe, expect, it, vi } from 'vitest';

import {
  cliTypes,
  type Wasm,
} from '../../../../../modules/infrastructure/wasm';
import {
  CURRENT_SCHEMA_VERSION,
  type RichTextDocument,
  richTextRepresentations,
} from '../../models';
import { pmDocToJSONString } from '../../prosemirror';
import { type PMStep } from '../../prosemirror/hs-lib';
import { schema } from '../../prosemirror/schema';
import { doc, heading, para } from '../../prosemirror/test-utils';
import { createAdapter } from './index';

const markdownDocument = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: richTextRepresentations.MARKDOWN,
  content,
});

const proseMirrorDocument = (pmDoc: Node): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: richTextRepresentations.PROSEMIRROR,
  content: pmDocToJSONString(pmDoc),
});

const pmDocBefore = doc([heading({ text: 'Title' }), para('Hello world')]);

const afterJSON = doc([
  heading({ text: 'Title', level: 2 }),
  para('Hello big world'),
]).toJSON();

const steps = ({
  mockedCliRun,
  docAfter = markdownDocument('## Title\n\nHello big world'),
}: {
  mockedCliRun: Wasm['runWasiCLIOutputingText'];
  docAfter?: RichTextDocument;
}) =>
  createAdapter({ runWasiCLIOutputingText: mockedCliRun }).proseMirrorSteps({
    pmDocBefore,
    docAfter,
    proseMirrorSchema: schema,
  });

const success = (stepsJSON: PMStep[]) =>
  JSON.stringify({ data: { doc: afterJSON, steps: stepsJSON } });

describe('pandoc-diff-patch proseMirrorSteps', () => {
  it('invokes the CLI with the live doc as ProseMirror and a markdown after side', async () => {
    const mockedCliRun = vi.fn().mockResolvedValue(success([]));

    await steps({ mockedCliRun });

    expect(mockedCliRun).toHaveBeenCalledWith({
      type: cliTypes.HS_LIB,
      args: [
        'v2-hs-lib',
        'proseMirrorSteps',
        '--before-format',
        'prosemirror',
        '--after-format',
        'markdown',
        '--',
        pmDocToJSONString(pmDocBefore),
        '## Title\n\nHello big world',
      ],
    });
  });

  it('passes a ProseMirror after side through in its own format', async () => {
    const mockedCliRun = vi.fn().mockResolvedValue(success([]));
    const docAfter = proseMirrorDocument(doc([para('Hello big world')]));

    await steps({ mockedCliRun, docAfter });

    expect(mockedCliRun).toHaveBeenCalledWith({
      type: cliTypes.HS_LIB,
      args: [
        'v2-hs-lib',
        'proseMirrorSteps',
        '--before-format',
        'prosemirror',
        '--after-format',
        'prosemirror',
        '--',
        pmDocToJSONString(pmDocBefore),
        docAfter.content,
      ],
    });
  });

  it('returns the after doc and the steps as prosemirror-transform steps', async () => {
    const mockedCliRun = vi.fn().mockResolvedValue(
      success([
        { stepType: 'attr', pos: 0, attr: 'level', value: 2 },
        {
          stepType: 'replace',
          from: 14,
          to: 14,
          slice: { content: [{ type: 'text', text: 'big ' }] },
        },
        { stepType: 'addMark', from: 14, to: 17, mark: { type: 'strong' } },
        { stepType: 'removeMark', from: 14, to: 17, mark: { type: 'em' } },
      ])
    );

    const result = await steps({ mockedCliRun });

    expect(result.pmDocAfter.toJSON()).toEqual(afterJSON);
    expect(result.steps).toHaveLength(4);
    expect(result.steps[0]).toBeInstanceOf(AttrStep);
    expect(result.steps[1]).toBeInstanceOf(ReplaceStep);
    expect(result.steps[2]).toBeInstanceOf(AddMarkStep);
    expect(result.steps[3]).toBeInstanceOf(RemoveMarkStep);
    expect(result.steps.map((step) => step.toJSON())).toEqual([
      { stepType: 'attr', pos: 0, attr: 'level', value: 2 },
      {
        stepType: 'replace',
        from: 14,
        to: 14,
        slice: { content: [{ type: 'text', text: 'big ' }] },
      },
      { stepType: 'addMark', from: 14, to: 17, mark: { type: 'strong' } },
      { stepType: 'removeMark', from: 14, to: 17, mark: { type: 'em' } },
    ]);
  });

  it('throws when the CLI reports errors', async () => {
    const mockedCliRun = vi
      .fn()
      .mockResolvedValue(
        JSON.stringify({ errors: [{ message: 'Cannot emit steps: table' }] })
      );

    await expect(steps({ mockedCliRun })).rejects.toThrow(
      'Cannot emit steps: table'
    );
  });

  it('throws when the CLI output is not JSON', async () => {
    const mockedCliRun = vi.fn().mockResolvedValue('');

    await expect(steps({ mockedCliRun })).rejects.toThrow();
  });

  it('throws on a malformed step', async () => {
    const mockedCliRun = vi.fn().mockResolvedValue(
      JSON.stringify({
        data: { doc: afterJSON, steps: [{ stepType: 'teleport', from: 1 }] },
      })
    );

    await expect(steps({ mockedCliRun })).rejects.toThrow();
  });
});
