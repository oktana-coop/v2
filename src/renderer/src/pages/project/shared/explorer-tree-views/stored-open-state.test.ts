import { beforeEach, describe, expect, it } from 'vitest';

import { type ProjectId } from '../../../../../../modules/domain/project';
import { readStoredOpenState, storeOpenState } from './stored-open-state';

const projectId = '/projects/one' as ProjectId;
const otherProjectId = '/projects/two' as ProjectId;

describe('stored explorer open state', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is empty for a project nothing was stored for', () => {
    const openState = readStoredOpenState(projectId);

    expect(openState).toEqual({});
  });

  it('reads back what was stored for the project', () => {
    storeOpenState({ projectId, openState: { notes: false, drafts: true } });

    const openState = readStoredOpenState(projectId);

    expect(openState).toEqual({ notes: false, drafts: true });
  });

  it('keeps each project apart', () => {
    storeOpenState({ projectId, openState: { notes: false } });

    const openState = readStoredOpenState(otherProjectId);

    expect(openState).toEqual({});
  });

  it('is empty when what is stored is not an open state', () => {
    storeOpenState({ projectId, openState: { notes: false } });
    const [key] = Object.keys(localStorage);
    localStorage.setItem(key, '{"notes":"closed"}');

    const openState = readStoredOpenState(projectId);

    expect(openState).toEqual({});
  });

  it('is empty when what is stored is not JSON', () => {
    storeOpenState({ projectId, openState: { notes: false } });
    const [key] = Object.keys(localStorage);
    localStorage.setItem(key, 'notes');

    const openState = readStoredOpenState(projectId);

    expect(openState).toEqual({});
  });
});
