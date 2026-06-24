import { isValidProjectId } from '.';

describe('ProjectId', () => {
  it('validates a valid project path', () => {
    expect(isValidProjectId('/users/joe/documents/my-project')).toBe(true);
  });
});
