import { isValidProjectId } from '.';

describe('ProjectId', () => {
  it('validates an Automerge URL project ID', () => {
    expect(isValidProjectId('automerge:2mwuwvgxs5bVhgLadUuofnTCLwDm')).toBe(
      true
    );
  });

  it('validates a valid project path', () => {
    expect(isValidProjectId('/users/joe/documents/my-project')).toBe(true);
  });
});
