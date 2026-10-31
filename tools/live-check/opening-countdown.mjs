/* global document */
/** The participant's existing reading window, played against the real server. */
export async function checkOpeningCountdown({ browser, api, hostSocket, URL, shot, check }) {
  const quiz = await api('POST', '/quizzes', { title: 'Opening countdown check', language: 'en' });
  const host = hostSocket();
  const context = await browser.newContext({
    viewport: { width: 390, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'en-US',
  });
  const page = await context.newPage();
  const timer = page.getByRole('timer', { name: /Read the question carefully/ });
  let pin;
  try {
    await api('POST', `/quizzes/${quiz.id}/questions`, {
      type: 'single_choice',
      prompt: 'Which city is the capital of France?',
      timeLimitS: 30,
      options: ['Paris', 'Lyon'].map((text, i) => ({
        text,
        color: i ? 'blue' : 'red',
        shape: i ? 'diamond' : 'triangle',
        isCorrect: i === 0,
      })),
    });
    await api('PATCH', `/quizzes/${quiz.id}/status`, { status: 'ready' });
    if (!host.connected) await new Promise((resolve) => host.once('connect', resolve));
    ({ pin } = await host.emitWithAck('host:create', { quizId: quiz.id }));
    await page.goto(`${URL}/join/${pin}`);
    await page.getByLabel(/Nickname/).fill('Countdown');
    await page.getByRole('button', { name: 'Join the lobby', exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('.qd-player')?.dataset.state === 'LOBBY',
    );
    host.emit('host:motion', { pin, on: true });
    host.emit('host:start', { pin });
    await timer.waitFor();
    check(
      !(await page.getByRole('button', { name: 'Paris', exact: true }).count()),
      'reading: answers remain locked',
    );
    const initial = await timer.textContent();
    await page.waitForFunction(
      (before) => {
        const counter = document.querySelector('[role="timer"][aria-label*="Read the question"]');
        return counter && counter.textContent !== before;
      },
      initial,
      { timeout: 4000 },
    );
    check(true, 'reading: the displayed seconds advance on the server clock');
    await shot(page, 'phone-opening-animated');
    // Pause while still reading, then wait beyond the original opening deadline.
    host.emit('host:pause', { pin, paused: true });
    await page.waitForTimeout(400);
    const frozen = await timer.textContent();
    await page.waitForTimeout(3200);
    check(
      (await timer.textContent()) === frozen,
      'paused: the opening count survives its original deadline',
    );
    await shot(page, 'phone-opening-paused');
    await page.setViewportSize({ width: 320, height: 568 });
    await shot(page, 'phone-opening-small');
    const bounds = await timer.locator('..').boundingBox();
    check(
      bounds.x >= 0 && bounds.x + bounds.width <= 320,
      '320px: countdown stays within the phone',
    );
    await page.setViewportSize({ width: 780, height: 390 });
    await shot(page, 'phone-opening-landscape');
    await page.setViewportSize({ width: 390, height: 780 });
    // Reload while paused: reconnect must use the frozen count, not start a local sequence.
    await page.reload();
    await timer.waitFor();
    check((await timer.textContent()) === frozen, 'reconnect: server remainder is restored');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await shot(page, 'phone-opening-reduced-motion');
    host.emit('host:motion', { pin, on: false });
    await page.waitForTimeout(200);
    host.emit('host:pause', { pin, paused: false });
    await page.getByRole('button', { name: 'Paris', exact: true }).waitFor();
    check(!(await timer.count()), 'resume: answers replace the countdown without an extra delay');
    await page.getByRole('button', { name: 'Paris', exact: true }).click();
    check(true, 'answer control accepts a click after opening');
    await shot(page, 'phone-opening-answer');
  } finally {
    if (pin) await api('POST', `/games/${pin}/end`).catch(() => undefined);
    host.disconnect();
    await context.close();
    await api('PATCH', `/quizzes/${quiz.id}/status`, { status: 'draft' }).catch(() => undefined);
    await api('DELETE', `/quizzes/${quiz.id}`).catch(() => undefined);
  }
}
