import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Editor } from '@tiptap/core';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { MarkdownEditor, extensionsFor, type MarkdownEditorProps } from './markdown-editor';

// The toolbar's image button uses the upload mutation, hence a QueryClient.
const render = (ui: React.ReactElement) =>
  rtlRender(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

function Harness(props: Partial<MarkdownEditorProps> & { initial?: string }) {
  const [value, setValue] = useState(props.initial ?? '');
  return (
    <>
      <MarkdownEditor aria-label="Body" {...props} value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
    </>
  );
}

describe('MarkdownEditor', () => {
  it('opens in visual mode, loads Markdown and renders it as rich text', () => {
    render(<Harness initial={'Hello **world**\n\n- a\n- b'} />);
    const editor = screen.getByLabelText('Body');
    expect(editor.getAttribute('contenteditable')).toBe('true');
    expect(editor.querySelector('strong')?.textContent).toBe('world');
    expect(editor.querySelectorAll('ul > li')).toHaveLength(2);
  });

  it('toggles to source mode and edits raw Markdown', () => {
    render(<Harness initial="Hello" />);
    fireEvent.click(screen.getByRole('button', { name: 'Markdown' }));
    const textarea = screen.getByLabelText('Body') as HTMLTextAreaElement;
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.value).toBe('Hello');
    fireEvent.change(textarea, { target: { value: '_it_ **b**' } });
    expect(screen.getByTestId('value').textContent).toBe('_it_ **b**');
    // back to visual: the source edit is reflected in the rich text
    fireEvent.click(screen.getByRole('button', { name: 'Éditeur visuel' }));
    const editor = screen.getByLabelText('Body');
    expect(editor.querySelector('em')?.textContent).toBe('it');
    expect(editor.querySelector('strong')?.textContent).toBe('b');
  });

  it('serialises toolbar formatting back to Markdown', () => {
    render(<Harness initial="Hello" />);
    // wrapping the current block needs no selection, unlike marks
    fireEvent.click(screen.getByRole('button', { name: 'Liste à puces' }));
    expect(screen.getByTestId('value').textContent).toBe('- Hello');
    expect(screen.getByRole('button', { name: 'Liste à puces' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('clears all the formatting of the selection, marks and list', () => {
    render(<Harness initial={'- **Hello**'} />);
    const editor = screen.getByLabelText('Body');
    // Everything selected, as Ctrl+A does (the editor's own command, not the DOM's).
    fireEvent.keyDown(editor, { key: 'a', ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Effacer la mise en forme' }));
    expect(screen.getByTestId('value').textContent).toBe('Hello');
  });

  it('keeps code out of the bar: it is typed in the source', () => {
    render(<Harness initial="Hello" />);
    expect(screen.queryByRole('button', { name: 'Code' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Bloc de code' })).toBeNull();
  });

  it('inline profile offers no list/code-block tools', () => {
    render(<Harness profile="inline" initial="one" />);
    expect(screen.getByRole('button', { name: 'Gras' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Liste à puces' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Bloc de code' })).toBeNull();
  });

  it('inline profile round-trips Markdown through source mode (custom doc node)', () => {
    render(<Harness profile="inline" initial="one" />);
    fireEvent.click(screen.getByRole('button', { name: 'Markdown' }));
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: '**one** two' } });
    fireEvent.click(screen.getByRole('button', { name: 'Éditeur visuel' }));
    const editor = screen.getByLabelText('Body');
    expect(editor.querySelector('strong')?.textContent).toBe('one');
    expect(editor.querySelectorAll('p')).toHaveLength(1);
    expect(screen.getByTestId('value').textContent).toBe('**one** two');
  });

  it('inline profile serialises the custom single-paragraph doc (not an empty string)', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: extensionsFor('inline'),
      content: '**one** two',
      contentType: 'markdown',
    });
    expect(editor.getMarkdown()).toBe('**one** two');
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' three');
    expect(editor.getMarkdown()).toBe('**one** two three');
    editor.destroy();
  });
});
