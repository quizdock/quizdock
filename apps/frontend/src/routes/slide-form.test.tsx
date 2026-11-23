import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '../test/harness';
import type { QuizDetailDtoSlidesItem } from '../api/generated/model';
import { quizVariables } from '@quiz-dock/contracts';
import { VariablesContext } from '@/lib/variables';
import { SlideForm } from './slide-form';

function renderForm(
  quizStatus: 'draft' | 'ready' = 'draft',
  onClose = vi.fn(),
  quizFields?: { title: string; questionCount?: number },
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      {/* The quiz's values, as the editor gives them. */}
      <VariablesContext.Provider value={quizFields ? quizVariables(quizFields) : {}}>
        <SlideForm quizId="q1" quizStatus={quizStatus} onClose={onClose} />
      </VariablesContext.Provider>
    </QueryClientProvider>,
  );
  return onClose;
}

/** The slide's display time: the drawer of its timeline's time row. */
const openTimeSettings = () =>
  fireEvent.click(screen.getByRole('button', { name: /^Durée minimale|^Manuel/ }));

const posted = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls
    .filter(([url, o]) => String(url).includes('/quizzes/q1/slides') && o?.method === 'POST')
    .map(([, o]) => JSON.parse(String((o as RequestInit).body)));

describe('SlideForm (UI system §3)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('flags an empty block, left out when saved', () => {
    mockApi([]);
    renderForm();
    expect(screen.getByText('Vide — ignoré à l’enregistrement.')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Titre…'), {
      target: { value: 'Bienvenue' },
    });
    expect(screen.queryByText('Vide — ignoré à l’enregistrement.')).toBeNull();
  });

  it('a variable picked from a heading’s bar is written where the caret is', () => {
    mockApi([]);
    renderForm();
    const heading = screen.getByPlaceholderText('Titre…') as HTMLInputElement;
    fireEvent.change(heading, { target: { value: 'Bienvenue' } });
    heading.setSelectionRange(0, 0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Insérer une variable' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /\{title\}/ }));
    expect(heading).toHaveValue('{title}Bienvenue');
  });

  it('the picker shows what the quiz’s variables read, the lobby’s described', () => {
    mockApi([]);
    renderForm('draft', vi.fn(), { title: 'Discover France', questionCount: 12 });
    fireEvent.click(screen.getAllByRole('button', { name: 'Insérer une variable' })[0]);
    expect(screen.getByRole('button', { name: '{title} Discover France' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '{questions} 12' })).toBeInTheDocument();
    const lobby = screen.getByRole('group', { name: 'Salon' });
    expect(within(lobby).getByRole('button', { name: /^\{pin\} Le PIN/ })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Quiz' })).queryByText('{pin}')).toBeNull();
  });

  it('a variable picked from a text’s bar is saved as written', async () => {
    const fetchMock = mockApi([
      { method: 'POST', path: '/quizzes/q1/slides', status: 201, body: {} },
    ]);
    const onClose = renderForm();
    fireEvent.change(screen.getByPlaceholderText('Titre…'), { target: { value: 'Bienvenue' } });
    fireEvent.click(screen.getByRole('button', { name: 'Texte' }));
    const pickers = screen.getAllByRole('button', { name: 'Insérer une variable' });
    fireEvent.click(pickers[pickers.length - 1]);
    fireEvent.click(screen.getByRole('button', { name: /\{questions\}/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(JSON.stringify(posted(fetchMock)[0].blocks)).toContain('"md":"{questions}"');
  });

  it('a removed block can be taken back', () => {
    mockApi([]);
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('Titre…'), {
      target: { value: 'Bienvenue' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Retirer le bloc' })[0]);
    expect(screen.queryByDisplayValue('Bienvenue')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Rétablir' }));
    expect(screen.getByDisplayValue('Bienvenue')).toBeInTheDocument();
  });

  it('a draft saves a slide that shows nothing yet', async () => {
    const fetchMock = mockApi([
      { method: 'POST', path: '/quizzes/q1/slides', status: 201, body: {} },
    ]);
    const onClose = renderForm();
    fireEvent.change(screen.getByPlaceholderText('Titre…'), {
      target: { value: 'x' },
    });
    fireEvent.change(screen.getByPlaceholderText('Titre…'), {
      target: { value: ' ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(posted(fetchMock)[0].blocks).toEqual([]);
  });

  it('in a published quiz, an empty slide offers to go back to draft', async () => {
    const fetchMock = mockApi([]);
    renderForm('ready');
    fireEvent.change(screen.getByPlaceholderText('Titre…'), {
      target: { value: ' ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByText('Enregistrer cette diapositive vide ?')).toBeInTheDocument();
    expect(posted(fetchMock)).toHaveLength(0);
  });
});

// Non-regression around what the timeline will replace: the slide's media and its display time.
describe('SlideForm — media and display time', () => {
  const VIDEO = '01M3GM8JMFRA3DJ04SWWDWPPC1';
  const SOUND = '01M3GM8JMFRA3DJ04SWWDWPPC2';
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  const slideWith = (over: Partial<QuizDetailDtoSlidesItem>) =>
    ({
      id: 's1',
      quizId: 'q1',
      beforeQuestionId: null,
      orderIndex: 0,
      blocks: [
        { type: 'heading', id: 'h1', text: 'Bienvenue', level: 1 },
        { type: 'text', id: 't1', md: 'Au programme' },
      ],
      mediaId: null,
      gradient: null,
      backgroundStyle: null,
      videoMediaId: null,
      videoLoop: true,
      videoSound: true,
      audioMediaId: null,
      waveformSize: 'hidden',
      audioTarget: null,
      textTone: 'light',
      textOutline: true,
      displayDelayS: null,
      ...over,
    }) as unknown as QuizDetailDtoSlidesItem;

  const renderSlide = (slide: QuizDetailDtoSlidesItem) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SlideForm quizId="q1" slide={slide} onClose={vi.fn()} />
      </QueryClientProvider>,
    );
  };
  const put = (fetchMock: ReturnType<typeof mockApi>) =>
    fetchMock.mock.calls
      .filter(([url, o]) => String(url).includes('/slides/s1') && o?.method === 'PUT')
      .map(([, o]) => JSON.parse(String((o as RequestInit).body)));

  it('as a question’s (SPECIFICATIONS-STEP-EDITOR): Cmd+S saves it, it stays open, its preview pins', async () => {
    const fetchMock = mockApi([{ method: 'PUT', path: '/slides/s1', status: 200, body: {} }]);
    renderSlide(slideWith({ displayDelayS: 12 }));
    // The room's screen, projection or phone, pinnable at the top.
    expect(screen.getByRole('button', { name: 'Épingler' })).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Montrer la réponse' })).toBeNull();
    openTimeSettings();
    fireEvent.change(screen.getByLabelText('Durée (s)'), { target: { value: '13' } });
    screen.getByLabelText('Durée (s)').dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 's',
        code: 'KeyS',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await waitFor(() => expect(put(fetchMock)).toHaveLength(1));
    // Saved: still open, clean, and saying so.
    expect(await screen.findByText('Enregistré')).toBeInTheDocument();
    expect(screen.getByLabelText('Durée (s)')).toHaveValue(13);
  });

  it('saves a loaded slide as it was, but for the one change', async () => {
    const fetchMock = mockApi([{ method: 'PUT', path: '/slides/s1', status: 200, body: {} }]);
    renderSlide(
      slideWith({
        videoMediaId: VIDEO,
        videoLoop: false,
        videoSound: false,
        audioMediaId: SOUND,
        waveformSize: 'L',
        audioTarget: 'everyone',
        textTone: 'dark',
        textOutline: false,
        displayDelayS: 12,
      } as Partial<QuizDetailDtoSlidesItem>),
    );
    openTimeSettings();
    fireEvent.change(screen.getByLabelText('Durée (s)'), {
      target: { value: '13' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(put(fetchMock)).toHaveLength(1));
    expect(put(fetchMock)[0]).toEqual({
      blocks: [
        { type: 'heading', id: 'h1', text: 'Bienvenue', level: 1 },
        { type: 'text', id: 't1', md: 'Au programme' },
      ],
      mediaId: null,
      gradient: null,
      imageMediaId: null,
      videoMediaId: VIDEO,
      mediaPosition: 'behind',
      mediaStyle: null,
      videoLoop: false,
      videoSound: false,
      audioMediaId: SOUND,
      waveformSize: 'L',
      audioTarget: 'everyone',
      textTone: 'dark',
      textOutline: false,
      backgroundStyle: null,
      displayDelayS: 13,
    });
  });

  it('a video playing its sound takes the place of a sound: only one is sent', async () => {
    const fetchMock = mockApi([{ method: 'PUT', path: '/slides/s1', status: 200, body: {} }]);
    renderSlide(slideWith({ videoMediaId: VIDEO, videoSound: true, audioMediaId: SOUND }));
    openTimeSettings();
    fireEvent.change(screen.getByLabelText('Enchaînement (mode automatique)'), {
      target: { value: 'manual' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(put(fetchMock)).toHaveLength(1));
    expect(put(fetchMock)[0]).toMatchObject({
      videoMediaId: VIDEO,
      videoSound: true,
      audioMediaId: null,
      displayDelayS: 0,
    });
  });

  it.each([
    ['default', null],
    ['manual', 0],
    ['custom', 10],
  ])('the display time %s is sent as %s', async (mode, sent) => {
    const fetchMock = mockApi([{ method: 'PUT', path: '/slides/s1', status: 200, body: {} }]);
    // Start from another mode, so that choosing this one is a change.
    renderSlide(slideWith({ displayDelayS: mode === 'custom' ? null : 7 }));
    openTimeSettings();
    fireEvent.change(screen.getByLabelText('Enchaînement (mode automatique)'), {
      target: { value: mode },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(put(fetchMock)).toHaveLength(1));
    expect(put(fetchMock)[0].displayDelayS).toBe(sent);
  });
});

describe('SlideForm — blocks', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('saves the blocks in order, a heading at its level', async () => {
    const fetchMock = mockApi([
      { method: 'POST', path: '/quizzes/q1/slides', status: 201, body: {} },
    ]);
    const onClose = renderForm();
    fireEvent.change(screen.getByPlaceholderText('Titre…'), {
      target: { value: 'Bienvenue' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Titre' }));
    fireEvent.change(screen.getAllByRole('combobox', { name: 'Niveau' })[1], {
      target: { value: '2' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('Titre…')[1], {
      target: { value: 'Programme' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(posted(fetchMock)[0].blocks).toEqual([
      expect.objectContaining({ type: 'heading', text: 'Bienvenue', level: 1 }),
      expect.objectContaining({ type: 'heading', text: 'Programme', level: 2 }),
    ]);
  });

  it('adds only headings and texts: columns and the media come with the layouts', () => {
    mockApi([]);
    renderForm();
    for (const gone of ['Sous-titre', 'Média', '2 colonnes', '3 colonnes'])
      expect(screen.queryByRole('button', { name: gone })).toBeNull();
    expect(screen.getByRole('button', { name: 'Texte' })).toBeInTheDocument();
  });
});
