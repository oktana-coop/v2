import * as Effect from 'effect/Effect';
import path from 'path';

import { mapErrorTo } from '../../../../utils/errors';
import { RepositoryError } from '../errors';
import { IsoGitDeps } from './types';

export type WriteGitignoreArgs = Omit<IsoGitDeps, 'isoGitHttp'>;

const gitignoreContent =
  `
# macOS
.DS_Store

# Windows
Thumbs.db
Desktop.ini

# Editors & IDEs
.vscode/
.idea/
*.swp
*.swo
`.trim() + '\n';

export const writeGitignore = ({
  isoGitFs,
  dir,
}: WriteGitignoreArgs): Effect.Effect<void, RepositoryError, never> =>
  Effect.tryPromise({
    try: () =>
      isoGitFs.promises.writeFile(
        path.join(dir, '.gitignore'),
        gitignoreContent,
        'utf8'
      ),
    catch: mapErrorTo(RepositoryError, 'Error writing MERGE_HEAD'),
  });
