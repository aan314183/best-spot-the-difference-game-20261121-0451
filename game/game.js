/* Lantern Lane — game rules and state.
   Owns the round: which scene, which differences are found, the
   countdown, the score, hints, win/lose, and the deterministic
   screenshot states (?shot=start|play|win, &level=1..3). Input is
   mouse clicks on either panel plus keyboard (H hint, R restart,
   1/2/3 scene, N next, M mute). No randomness anywhere: a hint always
   picks the first unfound difference, so every state is reproducible. */

const LanternGame = (function () {
  const HIT_R = 30;
  const WRONG_PENALTY = 25;
  const HINT_COST = 50;
  const FIND_POINTS = 100;

  let sceneIndex = 0;
  let found = new Set();
  let score = 0;
  let timeLeft = 0;
  let hintsLeft = 3;
  let status = 'start'; // start | play | win | done | timeout
  let timerId = null;
  let completed = [false, false, false];
  let shotMode = null;

  const $ = (id) => document.getElementById(id);
  const scene = () => SCENES[sceneIndex];
  const totalDiffs = () => scene().differences.length;
  const remaining = () => totalDiffs() - found.size;

  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function renderPanels() {
    $('panelLeft').innerHTML =
      '<span class="tag">LEFT</span>' + buildPanelSvg(scene(), 'left');
    $('panelRight').innerHTML =
      '<span class="tag right">RIGHT</span>' + buildPanelSvg(scene(), 'right');
    for (const idx of found) drawMarker(idx);
  }

  function svgOf(panelEl) {
    return panelEl.querySelector('svg');
  }

  function drawMarker(idx) {
    const diff = scene().differences[idx];
    for (const panelId of ['panelLeft', 'panelRight']) {
      const svg = svgOf($(panelId));
      if (!svg) continue;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'marker');
      g.innerHTML =
        '<circle class="marker-ring" cx="' + diff.x + '" cy="' + diff.y + '" r="24"/>' +
        '<text class="marker-check" x="' + diff.x + '" y="' + (diff.y + 7) + '">✓</text>';
      svg.appendChild(g);
    }
  }

  function drawHintPulse(idx) {
    const diff = scene().differences[idx];
    for (const panelId of ['panelLeft', 'panelRight']) {
      const svg = svgOf($(panelId));
      if (!svg) continue;
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('class', 'hint-ring');
      c.setAttribute('cx', diff.x);
      c.setAttribute('cy', diff.y);
      c.setAttribute('r', 26);
      svg.appendChild(c);
      setTimeout(() => c.remove(), 1250);
    }
  }

  function drawMiss(x, y, panelEl) {
    const svg = svgOf(panelEl);
    if (!svg) return;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'miss-x');
    const s = 10;
    g.innerHTML =
      '<line x1="' + (x - s) + '" y1="' + (y - s) + '" x2="' + (x + s) + '" y2="' + (y + s) + '"/>' +
      '<line x1="' + (x + s) + '" y1="' + (y - s) + '" x2="' + (x - s) + '" y2="' + (y + s) + '"/>';
    svg.appendChild(g);
    setTimeout(() => g.remove(), 850);
  }

  function updateHud() {
    $('sceneName').textContent = scene().emoji + ' ' + scene().name;
    $('counter').innerHTML = '<b>' + remaining() + '</b> LEFT';
    $('score').innerHTML = 'Score <b>' + score + '</b>';
    $('timer').textContent = '⏱ ' + fmtTime(Math.max(0, timeLeft));
    $('timer').classList.toggle('low', status === 'play' && timeLeft <= 30);
    $('timefill').style.width = Math.max(0, (timeLeft / scene().timeLimit) * 100) + '%';
    $('timebar').classList.toggle('low', status === 'play' && timeLeft <= 30);
    $('hintBtn').textContent = '💡 Hint (' + hintsLeft + ') −' + HINT_COST;
    $('hintBtn').disabled = status !== 'play' || hintsLeft <= 0 || remaining() === 0;
    $('muteBtn').textContent = SoundKit.isMuted() ? '🔇 Muted' : '🔊 Sound';
    const tabs = document.querySelectorAll('nav.leveltabs button');
    tabs.forEach((b, i) => {
      b.classList.toggle('active', i === sceneIndex);
      b.classList.toggle('done', completed[i]);
      b.textContent = (completed[i] ? '✓ ' : '') + SCENES[i].emoji + ' ' + (i + 1);
    });
  }

  function setMessage(text) {
    $('message').textContent = text;
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
      if (status !== 'play') return;
      timeLeft -= 1;
      if (timeLeft <= 30 && timeLeft > 0) SoundKit.playTick();
      if (timeLeft <= 0) {
        timeLeft = 0;
        updateHud();
        endRound(false);
        return;
      }
      updateHud();
    }, 1000);
  }

  function stopTimer() {
    if (timerId !== null) clearInterval(timerId);
    timerId = null;
  }

  function startLevel(index) {
    sceneIndex = index;
    found = new Set();
    score = 0; // score is per scene: every scene is its own round
    timeLeft = scene().timeLimit;
    hintsLeft = 3;
    status = 'play';
    hideOverlay();
    renderPanels();
    updateHud();
    setMessage('Find ' + totalDiffs() + ' differences — click one on either picture. ' + scene().blurb);
    startTimer();
  }

  function restartLevel() {
    startLevel(sceneIndex);
  }

  function firstUnfound() {
    for (let i = 0; i < totalDiffs(); i++) if (!found.has(i)) return i;
    return -1;
  }

  function useHint() {
    if (status !== 'play' || hintsLeft <= 0 || remaining() === 0) return;
    const idx = firstUnfound();
    if (idx < 0) return;
    hintsLeft -= 1;
    score = Math.max(0, score - HINT_COST);
    SoundKit.playHint();
    drawHintPulse(idx);
    setMessage('Hint: look near the ' + scene().differences[idx].label.toLowerCase() + '… (−' + HINT_COST + ' pts)');
    updateHud();
  }

  function onPanelClick(event, panelEl) {
    if (status !== 'play') return;
    const svg = svgOf(panelEl);
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 640;
    const y = ((event.clientY - rect.top) / rect.height) * 420;
    for (let i = 0; i < totalDiffs(); i++) {
      if (found.has(i)) continue;
      const d = scene().differences[i];
      const dx = x - d.x;
      const dy = y - d.y;
      if (dx * dx + dy * dy <= HIT_R * HIT_R) {
        found.add(i);
        score += FIND_POINTS;
        SoundKit.playFind();
        drawMarker(i);
        panelEl.classList.remove('found-flash');
        void panelEl.offsetWidth;
        panelEl.classList.add('found-flash');
        if (remaining() === 0) {
          updateHud();
          endRound(true);
        } else {
          setMessage('✓ ' + d.label + '! ' + remaining() + ' left.');
          updateHud();
        }
        return;
      }
    }
    score = Math.max(0, score - WRONG_PENALTY);
    SoundKit.playMiss();
    drawMiss(x, y, panelEl);
    setMessage('Not quite — nothing changed there. (−' + WRONG_PENALTY + ' pts)');
    updateHud();
  }

  function starCount() {
    if (timeLeft >= 90 && hintsLeft >= 2) return 3;
    if (timeLeft >= 45) return 2;
    return 1;
  }

  function endRound(won) {
    stopTimer();
    if (won) {
      const bonus = timeLeft * 2;
      score += bonus;
      completed[sceneIndex] = true;
      const allDone = completed.every(Boolean);
      status = allDone ? 'done' : 'win';
      SoundKit.playWin();
      updateHud();
      showWin(allDone, bonus);
    } else {
      status = 'timeout';
      SoundKit.playLose();
      updateHud();
      showTimeout();
    }
  }

  function showOverlay(html) {
    const ov = $('overlay');
    ov.innerHTML = '<div class="card">' + html + '</div>';
    ov.classList.remove('hidden');
  }

  function hideOverlay() {
    $('overlay').classList.add('hidden');
  }

  function showStart() {
    status = 'start';
    stopTimer();
    renderPanels();
    timeLeft = scene().timeLimit;
    updateHud();
    const cards = SCENES.map((s, i) =>
      '<button data-level="' + i + '"><span class="lv">' + s.emoji + '</span>' +
      '<span class="nm">' + s.name + '</span>' +
      '<span class="df">' + s.difficulty + '</span>' +
      '<span class="st">' + (completed[i] ? '✓ Completed' : '10 to find') + '</span></button>'
    ).join('');
    showOverlay(
      '<h2>🔍 LANTERN LANE</h2>' +
      '<p class="big">Spot the Difference</p>' +
      '<p>Two pictures, ten tiny changes. Click a difference on either side to circle it. ' +
      'Wrong clicks cost ' + WRONG_PENALTY + ' points, hints cost ' + HINT_COST + ' — and the clock is ticking.</p>' +
      '<div class="levelcards">' + cards + '</div>' +
      '<p>Keyboard: <b>H</b> hint · <b>R</b> restart · <b>1–3</b> scene · <b>M</b> mute</p>' +
      '<button class="cta" id="playBtn">▶ Play the Night Market</button>'
    );
    $('playBtn').addEventListener('click', () => startLevel(0));
    document.querySelectorAll('.levelcards button').forEach((b) =>
      b.addEventListener('click', () => startLevel(Number(b.dataset.level)))
    );
  }

  function showWin(allDone, bonus) {
    const stars = '★'.repeat(starCount()) + '☆'.repeat(3 - starCount());
    const next = sceneIndex + 1 < SCENES.length ? sceneIndex + 1 : 0;
    const nextName = allDone ? 'the Night Market again' : SCENES[next].name;
    showOverlay(
      '<h2>' + (allDone ? '🏆 ALL SCENES CLEARED!' : '🎉 SCENE COMPLETE!') + '</h2>' +
      '<div class="stars">' + stars + '</div>' +
      '<p class="big">You found all 10 differences in ' + scene().name + '!</p>' +
      '<p>Time bonus +' + bonus + ' · Total score <b>' + score + '</b> · ' +
      fmtTime(timeLeft) + ' to spare, ' + hintsLeft + ' hint' + (hintsLeft === 1 ? '' : 's') + ' left.</p>' +
      '<p>' + (allDone
        ? 'Every lantern, fish and snowflake matched. You are the sharpest eye on the lane!'
        : 'Ready for the next scene? It hides its differences even better.') + '</p>' +
      '<button class="cta" id="nextBtn">' + (allDone ? '↻ Play again' : '▶ Next: ' + nextName) + '</button> ' +
      '<button class="cta" id="againBtn" style="background:#241b3d;color:#f5ead2;border:2px solid #4a3670">↻ Replay this scene</button>'
    );
    $('nextBtn').addEventListener('click', () => startLevel(next));
    $('againBtn').addEventListener('click', () => restartLevel());
  }

  function showTimeout() {
    showOverlay(
      '<h2>⏰ TIME’S UP!</h2>' +
      '<p class="big">The lamps burned down with ' + remaining() + ' difference' + (remaining() === 1 ? '' : 's') + ' still hiding.</p>' +
      '<p>You found ' + found.size + ' of ' + totalDiffs() + ' in ' + scene().name + '. Score ' + score + '.</p>' +
      '<button class="cta" id="retryBtn">↻ Try again</button> ' +
      '<button class="cta" id="menuBtn" style="background:#241b3d;color:#f5ead2;border:2px solid #4a3670">☰ Scene select</button>'
    );
    $('retryBtn').addEventListener('click', () => restartLevel());
    $('menuBtn').addEventListener('click', () => showStart());
  }

  /* Deterministic screenshot states: ?shot=start | play | win, &level=1..3.
     play pre-marks the first four differences, win pre-marks all ten,
     so a screenshot can be reproduced byte for byte. */
  function applyShot() {
    const params = new URLSearchParams(window.location.search);
    shotMode = params.get('shot');
    const level = Number(params.get('level') || '1');
    if (level >= 1 && level <= SCENES.length) sceneIndex = level - 1;
    if (shotMode === 'play') {
      found = new Set([0, 1, 2, 3]);
      score = 400;
      timeLeft = 151;
      hintsLeft = 2;
      status = 'play';
      hideOverlay();
      renderPanels();
      updateHud();
      setMessage('✓ ' + scene().differences[3].label + '! 6 left.');
      // Frozen on purpose: the timer does not run in a screenshot
      // state, so the same URL always renders the same frame.
    } else if (shotMode === 'win') {
      found = new Set(scene().differences.map((_, i) => i));
      score = 1180;
      timeLeft = 90;
      hintsLeft = 2;
      status = 'win';
      completed[sceneIndex] = true;
      renderPanels();
      updateHud();
      showWin(false, 180);
    } else {
      showStart();
    }
  }

  function onKey(event) {
    if (event.key === 'h' || event.key === 'H') useHint();
    else if (event.key === 'r' || event.key === 'R') { if (status === 'play' || status === 'win' || status === 'timeout') restartLevel(); }
    else if (event.key === 'm' || event.key === 'M') { SoundKit.toggleMute(); updateHud(); }
    else if (event.key === 'n' || event.key === 'N') { if (status === 'win') startLevel((sceneIndex + 1) % SCENES.length); }
    else if (event.key >= '1' && event.key <= '3') startLevel(Number(event.key) - 1);
    else if (event.key === 'Enter' && status === 'start') startLevel(sceneIndex);
  }

  function init() {
    $('panelLeft').addEventListener('click', (e) => onPanelClick(e, $('panelLeft')));
    $('panelRight').addEventListener('click', (e) => onPanelClick(e, $('panelRight')));
    $('hintBtn').addEventListener('click', useHint);
    $('muteBtn').addEventListener('click', () => { SoundKit.toggleMute(); updateHud(); });
    $('restartBtn').addEventListener('click', () => { if (status !== 'start') restartLevel(); });
    document.querySelectorAll('nav.leveltabs button').forEach((b) =>
      b.addEventListener('click', () => startLevel(Number(b.dataset.scene)))
    );
    document.addEventListener('keydown', onKey);
    applyShot();
  }

  return { init: init };
})();
