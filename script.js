const STORAGE_KEY = 'focusflow_data_v1';
const RING_CIRCUMFERENCE = 2 * Math.PI * 126;

const MODE_META = {
  focus: { label: 'focus', color: '--accent-focus', durationKey: 'focus' },
  short: { label: 'short break', color: '--accent-short', durationKey: 'short' },
  long: { label: 'long break', color: '--accent-long', durationKey: 'long' },
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function loadData() {
  const defaults = {
    durations: { focus: 25, short: 5, long: 15 },
    tasks: [],
    activeTaskId: null,
    stats: { day: todayKey(), sessionsToday: 0, totalSessions: 0, totalMinutes: 0 },
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const merged = { ...defaults, ...parsed, durations: { ...defaults.durations, ...(parsed.durations || {}) } };
    if (merged.stats.day !== todayKey()) {
      merged.stats.day = todayKey();
      merged.stats.sessionsToday = 0;
    }
    return merged;
  } catch {
    return defaults;
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let data = loadData();

let mode = 'focus';
let secondsLeft = data.durations.focus * 60;
let totalSecondsForMode = secondsLeft;
let isRunning = false;
let timerId = null;
let focusSessionCount = 0; // used to decide short vs long break

// --- DOM refs ---
const timeDisplay = document.getElementById('timeDisplay');
const ringProgress = document.getElementById('ringProgress');
const startPauseBtn = document.getElementById('startPauseBtn');
const resetBtn = document.getElementById('resetBtn');
const skipBtn = document.getElementById('skipBtn');
const modeTabs = document.getElementById('modeTabs');
const streakCount = document.getElementById('streakCount');
const totalStats = document.getElementById('totalStats');
const currentTaskLabel = document.getElementById('currentTaskLabel');
const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const emptyHint = document.getElementById('emptyHint');
const settingsToggle = document.getElementById('settingsToggle');
const settingsPanel = document.getElementById('settingsPanel');
const focusInput = document.getElementById('focusInput');
const shortInput = document.getElementById('shortInput');
const longInput = document.getElementById('longInput');
const saveSettings = document.getElementById('saveSettings');

ringProgress.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;

// --- Rendering ---
function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function updateRing() {
  const fraction = totalSecondsForMode > 0 ? secondsLeft / totalSecondsForMode : 0;
  const offset = RING_CIRCUMFERENCE * (1 - fraction);
  ringProgress.style.strokeDashoffset = offset;
  ringProgress.style.stroke = `var(${MODE_META[mode].color})`;
}

function updateDisplay() {
  timeDisplay.textContent = formatTime(secondsLeft);
  updateRing();
  document.title = `${formatTime(secondsLeft)} · Focus Flow`;
}

function updateStreakUI() {
  streakCount.textContent = data.stats.sessionsToday;
  const hrs = Math.floor(data.stats.totalMinutes / 60);
  const mins = data.stats.totalMinutes % 60;
  totalStats.textContent = `${data.stats.totalSessions} focus sessions completed · ${hrs}h ${mins}m total`;
}

function updateCurrentTaskLabel() {
  const task = data.tasks.find(t => t.id === data.activeTaskId);
  currentTaskLabel.textContent = task ? task.text : 'No task selected';
}

function renderTasks() {
  taskList.innerHTML = '';
  emptyHint.style.display = data.tasks.length ? 'none' : 'block';
  data.tasks.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.completed ? ' completed' : '') + (task.id === data.activeTaskId ? ' active-task' : '');
    li.innerHTML = `
      <span class="task-check">${task.completed ? '✓' : ''}</span>
      <span class="task-text">${escapeHtml(task.text)}</span>
      <span class="task-pomos">${task.pomos > 0 ? '🍅'.repeat(Math.min(task.pomos, 5)) : ''}</span>
      <button class="task-delete" data-id="${task.id}" aria-label="Delete task">✕</button>
    `;
    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('task-delete')) return;
      if (e.target.classList.contains('task-check')) {
        task.completed = !task.completed;
        saveData();
        renderTasks();
        return;
      }
      data.activeTaskId = task.id;
      saveData();
      renderTasks();
      updateCurrentTaskLabel();
    });
    li.querySelector('.task-delete').addEventListener('click', () => {
      data.tasks = data.tasks.filter(t => t.id !== task.id);
      if (data.activeTaskId === task.id) data.activeTaskId = null;
      saveData();
      renderTasks();
      updateCurrentTaskLabel();
    });
    taskList.appendChild(li);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Timer logic ---
function setMode(newMode) {
  mode = newMode;
  [...modeTabs.children].forEach(btn => btn.classList.toggle('active', btn.dataset.mode === newMode));
  secondsLeft = data.durations[MODE_META[newMode].durationKey] * 60;
  totalSecondsForMode = secondsLeft;
  pause();
  updateDisplay();
}

function start() {
  if (isRunning) return;
  isRunning = true;
  startPauseBtn.textContent = 'Pause';
  requestNotificationPermission();
  timerId = setInterval(tick, 1000);
}

function pause() {
  isRunning = false;
  startPauseBtn.textContent = 'Start';
  clearInterval(timerId);
  timerId = null;
}

function reset() {
  pause();
  secondsLeft = data.durations[MODE_META[mode].durationKey] * 60;
  totalSecondsForMode = secondsLeft;
  updateDisplay();
}

function tick() {
  secondsLeft--;
  if (secondsLeft <= 0) {
    completeSession();
    return;
  }
  updateDisplay();
}

function completeSession() {
  pause();
  playDing();
  notify();

  if (mode === 'focus') {
    data.stats.sessionsToday++;
    data.stats.totalSessions++;
    data.stats.totalMinutes += data.durations.focus;
    focusSessionCount++;

    const activeTask = data.tasks.find(t => t.id === data.activeTaskId);
    if (activeTask) activeTask.pomos = (activeTask.pomos || 0) + 1;

    saveData();
    updateStreakUI();
    renderTasks();

    const nextMode = focusSessionCount % 4 === 0 ? 'long' : 'short';
    setMode(nextMode);
  } else {
    setMode('focus');
  }
}

function skip() {
  if (mode === 'focus') {
    setMode(focusSessionCount > 0 && focusSessionCount % 4 === 0 ? 'long' : 'short');
  } else {
    setMode('focus');
  }
}

// --- Sound + notifications ---
let audioCtx = null;
function playDing() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    [0, 0.18].forEach((delay, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 0 ? 880 : 1046.5;
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.25, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.4);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.4);
    });
  } catch {
    // audio not available; silently skip
  }
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function notify() {
  const justFinished = mode;
  const msg = justFinished === 'focus' ? 'Focus session done — take a break!' : 'Break over — back to focus.';
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Focus Flow', { body: msg });
  }
}

// --- Event wiring ---
startPauseBtn.addEventListener('click', () => (isRunning ? pause() : start()));
resetBtn.addEventListener('click', reset);
skipBtn.addEventListener('click', skip);

modeTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-tab');
  if (!btn) return;
  setMode(btn.dataset.mode);
});

taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;
  const task = { id: Date.now().toString(), text, completed: false, pomos: 0 };
  data.tasks.push(task);
  if (!data.activeTaskId) data.activeTaskId = task.id;
  saveData();
  renderTasks();
  updateCurrentTaskLabel();
  taskInput.value = '';
});

settingsToggle.addEventListener('click', () => {
  settingsPanel.classList.toggle('open');
});

saveSettings.addEventListener('click', () => {
  data.durations.focus = Math.max(1, parseInt(focusInput.value, 10) || 25);
  data.durations.short = Math.max(1, parseInt(shortInput.value, 10) || 5);
  data.durations.long = Math.max(1, parseInt(longInput.value, 10) || 15);
  saveData();
  reset();
  settingsPanel.classList.remove('open');
});

// --- Init ---
function init() {
  focusInput.value = data.durations.focus;
  shortInput.value = data.durations.short;
  longInput.value = data.durations.long;
  setMode('focus');
  updateStreakUI();
  renderTasks();
  updateCurrentTaskLabel();
}

init();
