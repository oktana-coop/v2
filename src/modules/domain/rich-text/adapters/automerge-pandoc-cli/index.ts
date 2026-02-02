import {
  cliTypes,
  type Wasm,
} from '../../../../../modules/infrastructure/wasm';
import { type RepresentationTransform } from '../../ports/representation-transform';
import { representationToCliArg } from './cli-args';

type HSLibConversionSuccessOutput = {
  data: string;
};

type HSLibError = {
  message: string;
};

type HSLibFailureOutput = {
  errors: HSLibError[];
};

type HSLibConversionOutput = HSLibConversionSuccessOutput | HSLibFailureOutput;

const isHSLibFailureOutput = (
  output: HSLibConversionOutput
): output is HSLibFailureOutput => {
  return 'errors' in output;
};

export const createAdapter = ({
  runWasiCLIOutputingText,
  runWasiCLIOutputingBinary,
}: {
  runWasiCLIOutputingText: Wasm['runWasiCLIOutputingText'];
  runWasiCLIOutputingBinary: Wasm['runWasiCLIOutputingBinary'];
}): RepresentationTransform => {
  const transformToText: RepresentationTransform['transformToText'] = async ({
    from,
    to,
    input,
  }) => {
    if (input === '') {
      return '';
    }

    const output = await runWasiCLIOutputingText({
      type: cliTypes.HS_LIB,
      args: [
        'v2-hs-lib',
        'convertToText',
        '--from',
        representationToCliArg(from),
        '--to',
        representationToCliArg(to),
        input,
      ],
    });

    if (!output) {
      throw new Error('Conversion failed: No output returned');
    }

    // TODO: Perform proper validation & handle error cases
    const parsedOutput = JSON.parse(output) as HSLibConversionOutput;

    if (isHSLibFailureOutput(parsedOutput)) {
      throw new Error(
        `Conversion failed: ${parsedOutput.errors.map((error) => error.message).join(', ')}`
      );
    }

    return parsedOutput.data;
  };

  const transformToBinary: RepresentationTransform['transformToBinary'] =
    async ({ from, to, input }) => {
      const output = await runWasiCLIOutputingBinary({
        type: cliTypes.HS_LIB,
        args: [
          'v2-hs-lib',
          'convertToBinary',
          '--from',
          representationToCliArg(from),
          '--to',
          representationToCliArg(to),
          input,
        ],
      });

      return output;
    };

  return {
    transformToText,
    transformToBinary,
  };
};
