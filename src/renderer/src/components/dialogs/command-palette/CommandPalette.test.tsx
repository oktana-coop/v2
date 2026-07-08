import { fireEvent, render, screen, within } from '@testing-library/react';

import { CommandPalette, type DocumentOption } from './CommandPalette';

const makeDocuments = (n: number): DocumentOption[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `doc-${i}`,
    title: `document-${i}`,
    onDocumentSelection: () => {},
  }));

describe('CommandPalette document list', () => {
  it('renders every document when the list is small', () => {
    render(
      <CommandPalette
        open
        onClose={() => {}}
        documentsGroupTitle="Project documents"
        documents={makeDocuments(5)}
      />
    );

    expect(screen.getAllByText(/^document-\d+$/)).toHaveLength(5);
    expect(
      screen.queryByText(/keep typing to narrow/i)
    ).not.toBeInTheDocument();
  });

  it('caps the rendered documents and shows a truncation hint for large lists', () => {
    render(
      <CommandPalette
        open
        onClose={() => {}}
        documentsGroupTitle="Project documents"
        documents={makeDocuments(200)}
      />
    );

    // Far fewer than 200 options render, keeping the un-virtualized list cheap.
    expect(screen.getAllByText(/^document-\d+$/).length).toBeLessThan(200);
    expect(screen.getByText(/keep typing to narrow/i)).toBeInTheDocument();
  });

  it('lets a query reach a document beyond the visible cap', () => {
    render(
      <CommandPalette
        open
        onClose={() => {}}
        documentsGroupTitle="Project documents"
        documents={makeDocuments(200)}
      />
    );

    // document-150 is past the visible cap, so it is not initially rendered...
    expect(screen.queryByText('document-150')).not.toBeInTheDocument();

    // ...but searching for it surfaces it.
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'document-150' },
    });

    const options = screen.getByRole('listbox');
    expect(within(options).getByText('document-150')).toBeInTheDocument();
    expect(
      screen.queryByText(/keep typing to narrow/i)
    ).not.toBeInTheDocument();
  });
});
