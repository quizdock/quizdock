/* global document, window */
/** Real layout checks for #265, using a room and quiz owned by this run only. */
export async function checkParticipantViewport({ browser, api, hostSocket, URL, shot, check }) {
  const prompt =
    'Read this question carefully. This is a longer but valid question to check the participant viewport. '.repeat(
      4,
    ) + 'What is the capital of France?';
  const quiz = await api('POST', '/quizzes', { title: 'Viewport check', language: 'en' });
  const options = ['Lyon', 'Paris', 'Marseille', 'Bordeaux'].map((text, i) => ({
    text,
    color: ['red', 'blue', 'yellow', 'green'][i],
    shape: ['triangle', 'diamond', 'circle', 'square'][i],
    isCorrect: i === 1,
  }));
  const context = await browser.newContext({
    viewport: { width: 390, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'en-US',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const host = hostSocket();
  let pin;
  const waitState = (state) =>
    page.waitForFunction(
      (expected) => document.querySelector('.qd-player')?.dataset.state === expected,
      state,
    );
  const frame = async (name) => {
    await page.waitForFunction(() => {
      const shell = document.querySelector('[data-shell="participant"]');
      return (
        shell && Math.abs(shell.getBoundingClientRect().height - window.visualViewport.height) < 1
      );
    });
    const geometry = await page.evaluate(() => ({
      height: window.innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      width: window.innerWidth,
      y: window.scrollY,
      header: document.querySelector('header').getBoundingClientRect().top,
    }));
    check(
      geometry.y === 0 &&
        geometry.header === 0 &&
        geometry.scrollHeight <= geometry.height + 1 &&
        geometry.scrollWidth <= geometry.width,
      `${name}: fixed participant frame ${JSON.stringify(geometry)}`,
    );
    await shot(page, name);
  };
  const next = async (state) => {
    host.emit('host:next', { pin });
    await waitState(state);
  };
  try {
    await api('POST', `/quizzes/${quiz.id}/questions`, {
      type: 'single_choice',
      prompt,
      options,
      timeLimitS: 240,
      answerExplanation: 'An explanation that remains readable on a small screen. '.repeat(20),
    });
    await api('POST', `/quizzes/${quiz.id}/questions`, {
      type: 'text_input',
      prompt,
      acceptedAnswers: [{ text: 'Paris' }],
      timeLimitS: 240,
    });
    await api('POST', `/quizzes/${quiz.id}/questions`, {
      type: 'ordering',
      prompt,
      options: options.map((o, i) => ({ ...o, correctOrderIndex: i })),
      timeLimitS: 240,
    });
    await api('POST', `/quizzes/${quiz.id}/slides`, {
      blocks: [
        {
          type: 'text',
          id: 'long',
          md: 'A readable long slide.\n\n'.repeat(40) + 'End of slide.',
        },
      ],
      textTone: 'dark',
      displayDelayS: 0,
    });
    await api('PATCH', `/quizzes/${quiz.id}/status`, { status: 'ready' });
    if (!host.connected) await new Promise((resolve) => host.once('connect', resolve));
    ({ pin } = await host.emitWithAck('host:create', { quizId: quiz.id }));
    await page.setViewportSize({ width: 320, height: 400 });
    await page.goto(`${URL}/join`);
    await frame('phone-viewport-pin-entry');
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto(`${URL}/join/${pin}`);
    await page.getByLabel(/Nickname/).fill('Viewport');
    await page.getByRole('button', { name: 'Join the lobby', exact: true }).click();
    await waitState('LOBBY');
    await frame('phone-viewport-lobby');
    host.emit('host:start', { pin });
    await waitState('ANSWERING');
    await page.getByRole('button', { name: 'Lyon', exact: true }).waitFor();
    await frame('phone-viewport-question');
    const promptArea = page.getByRole('heading', { level: 1 }).locator('..');
    check(
      await promptArea.evaluate((e) => e.scrollHeight > e.clientHeight && e.clientHeight > 0),
      'long prompt has its own nonempty scrolling region',
    );
    // Touch swipe, then wheel at the content boundary: neither may move the page.
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 190, y: 450 }],
    });
    for (let y = 430; y >= 150; y -= 20) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: 190, y }],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await promptArea.evaluate((e) => (e.scrollTop = e.scrollHeight));
    await promptArea.hover();
    await page.mouse.wheel(0, 800);
    await frame('phone-viewport-question-scrolled');
    const unzoomedHeight = await page.locator('.qd-shell').evaluate((e) => e.clientHeight);
    await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
    await page.waitForFunction(() => window.visualViewport.scale === 2);
    check(
      (await page.locator('.qd-shell').evaluate((e) => e.clientHeight)) === unzoomedHeight,
      'pinch zoom magnifies without shrinking the game layout',
    );
    await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 780, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await frame(`phone-viewport-${viewport.width}x${viewport.height}`);
      check(
        await promptArea.evaluate((e) => e.clientHeight > 0),
        'the prompt remains reachable on a short screen',
      );
    }
    await page.setViewportSize({ width: 390, height: 780 });
    await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
    await promptArea.evaluate((e) => (e.scrollTop = 0));
    await frame('phone-viewport-large-text');
    const leave = await page.getByRole('button', { name: 'Leave', exact: true }).boundingBox();
    check(leave.x >= 0 && leave.x + leave.width <= 390, 'Leave remains visible with 200% text');
    check(
      await promptArea.evaluate((e) => e.clientHeight >= 48),
      'larger text keeps a usable prompt region above the scrollable answers',
    );
    const lastAnswer = page.getByRole('button', { name: 'Bordeaux', exact: true });
    await lastAnswer.scrollIntoViewIfNeeded();
    const lastBox = await lastAnswer.boundingBox();
    check(lastBox.y + lastBox.height <= 780, 'last answer remains reachable with 200% text');
    await page.setViewportSize({ width: 320, height: 568 });
    await frame('phone-viewport-small-large-text');
    const smallLeave = await page.getByRole('button', { name: 'Leave', exact: true }).boundingBox();
    check(
      smallLeave.x >= 0 && smallLeave.x + smallLeave.width <= 320,
      'header controls remain reachable on a 320px phone with 200% text',
    );
    await lastAnswer.scrollIntoViewIfNeeded();
    await lastAnswer.click({ trial: true });
    await page.setViewportSize({ width: 390, height: 780 });
    await page.evaluate(() => (document.documentElement.style.fontSize = ''));
    await page.getByRole('button', { name: 'Show the big screen', exact: true }).click();
    await frame('phone-viewport-projection');
    await page.getByRole('button', { name: 'Back to my answers', exact: true }).click();
    host.emit('host:reveal', { pin });
    await waitState('REVEAL');
    await frame('phone-viewport-reveal');
    await next('LEADERBOARD');
    await frame('phone-viewport-standings');
    await next('ANSWERING');
    // Reduced available height models the space above a keyboard; not a real OS keyboard test.
    await page.setViewportSize({ width: 390, height: 390 });
    const input = page.getByRole('textbox');
    await input.fill('Paris');
    await page.getByRole('button', { name: 'Submit my answer', exact: true }).click();
    await page.getByText('Answer saved', { exact: false }).waitFor();
    await frame('phone-viewport-typed-answer');
    host.emit('host:reveal', { pin });
    await waitState('REVEAL');
    await next('LEADERBOARD');
    await next('ANSWERING');
    await frame('phone-viewport-ordering');
    await page.getByRole('button', { name: 'Submit my answer', exact: true }).click();
    await page.getByText('Answer saved', { exact: false }).waitFor();
    host.emit('host:reveal', { pin });
    await waitState('REVEAL');
    await next('SLIDE_SHOW');
    const slideEnd = page.getByText('End of slide.', { exact: true });
    await slideEnd.scrollIntoViewIfNeeded();
    const endBox = await slideEnd.boundingBox();
    check(
      endBox.y >= 0 && endBox.y + endBox.height <= 390,
      'the end of a long slide is inside the viewport after scrolling',
    );
    await frame('phone-viewport-slide');
    await next('PODIUM');
    await frame('phone-viewport-podium');
    await page.goto(`${URL}/login`);
    await page.locator('[data-shell="app"]').waitFor();
    check(
      await page.evaluate(
        () =>
          window.getComputedStyle(document.body).overflowY !== 'hidden' &&
          window.getComputedStyle(document.documentElement).overscrollBehaviorY !== 'none',
      ),
      'leaving participant routes restores ordinary page scrolling',
    );
  } catch (error) {
    await shot(page, 'phone-viewport-failure');
    throw error;
  } finally {
    if (pin) await api('POST', `/games/${pin}/end`).catch(() => undefined);
    host.disconnect();
    await context.close();
    await api('PATCH', `/quizzes/${quiz.id}/status`, { status: 'draft' }).catch(() => undefined);
    await api('DELETE', `/quizzes/${quiz.id}`);
  }
}
