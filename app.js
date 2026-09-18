const DATA_URL = './data/questions.json';
const STORAGE_KEY = 'edu-psychology-review-v1';
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

let questions = [];
let records = {};
let mode = 'sequential';
let activeType = 'single';
let scope = 'remaining';
let queue = [];
let currentId = null;
let selected = new Set();
let answered = false;
let round = 1;
let viewed = 0;
let touchStart = null;
let transitioning = false;
let transitionTimer = null;

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
function load() { try { records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { records = {}; } }
function recordFor(id) { return records[id] || { status: 'new', attempts: 0, wrong: 0 }; }
function isEligible(q) {
  if (q.type !== activeType) return false;
  const r = recordFor(q.id);
  if (r.status === 'known') return false;
  if (scope === 'wrong') return r.wrong > 0;
  if (scope === 'unseen') return r.attempts === 0;
  return true;
}
function shuffle(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
function buildQueue() {
  if (transitionTimer) clearTimeout(transitionTimer);
  transitionTimer = null;
  transitioning = false;
  const eligible = questions.filter(isEligible).map(q => q.id);
  queue = mode === 'random' ? shuffle(eligible) : eligible;
  viewed = 0;
  currentId = queue.shift() || null;
  selected = new Set();
  answered = false;
  render();
}
function nextCard() {
  let next = queue.shift();
  if (!next) {
    const eligible = questions.filter(isEligible).map(q => q.id);
    if (!eligible.length) { currentId = null; render(); return; }
    round++;
    queue = mode === 'random' ? shuffle(eligible) : eligible;
    next = queue.shift();
    viewed = 0;
  }
  currentId = next;
  selected = new Set();
  answered = false;
  render();
}
function stats() {
  const known = questions.filter(q => recordFor(q.id).status === 'known').length;
  const wrong = questions.filter(q => recordFor(q.id).wrong > 0 && recordFor(q.id).status !== 'known').length;
  const attempted = questions.filter(q => recordFor(q.id).attempts > 0).length;
  return { total: questions.length, known, remaining: questions.length - known, wrong, attempted };
}
function renderStats() {
  const s = stats();
  $('#statTotal').textContent = s.total;
  $('#statRemaining').textContent = s.remaining;
  $('#statKnown').textContent = s.known;
  $('#statWrong').textContent = s.wrong;
  $('#navRemaining').textContent = s.remaining;
  for (const type of ['single', 'multiple', 'judgment']) {
    $(`#${type}Count`).textContent = `${questions.filter(q => q.type === type).length} 题`;
  }
}
function currentQuestion() { return questions.find(q => q.id === currentId); }
function answerText(q) {
  if (q.type === 'judgment') return q.answer[0] === 'T' ? '正确' : '错误';
  return q.answer.join('、');
}
function renderOption(q, option) {
  const chosen = selected.has(option.key);
  const correct = q.answer.includes(option.key);
  const className = answered ? (correct ? 'correct' : chosen ? 'incorrect' : '') : chosen ? 'selected' : '';
  return `<button class="option ${className}" data-option="${escapeHtml(option.key)}" ${answered ? 'disabled' : ''} aria-pressed="${chosen}"><span class="letter">${escapeHtml(option.key === 'T' ? '√' : option.key === 'F' ? '×' : option.key)}</span><span>${escapeHtml(option.text)}</span></button>`;
}
function renderFeedback(q) {
  const correct = q.answer.length === selected.size && q.answer.every(a => selected.has(a));
  const selectedText = [...selected].join('、');
  const wrongChoices = [...selected].filter(a => !q.answer.includes(a));
  const missedChoices = q.answer.filter(a => !selected.has(a));
  const labelFor = (key) => {
    const option = q.options.find(item => item.key === key);
    return option ? `${key}「${option.text}」` : key;
  };
  const correctDetails = q.answer.map(labelFor).join('、');
  const explanation = q.explanation?.trim();
  const selectedDescription = q.type === 'judgment' ? (selected.has('T') ? '正确' : '错误') : selectedText;
  const isExclusion = /不属于|不包括|不正确|不是|不符合|错误的|描述错/.test(q.stem);
  const sourceNote = q.type === 'judgment'
    ? `原题库将这句话判为「${answerText(q)}」。原资料未附进一步的知识点说明。`
    : `${isExclusion ? '本题要求找出不符合题意的选项。' : '按原题库标注，'}应选 ${correctDetails}。原资料未附进一步的知识点说明。`;
  return `<div class="feedback">
    <div class="feedback-header ${correct ? 'good' : 'bad'}"><span>${correct ? '✓' : '✕'}</span>${correct ? '回答正确，继续保持' : '回答有误，看看答案'}</div>
    <div class="feedback-detail"><p class="answer-label"><strong>正确答案：</strong>${escapeHtml(answerText(q))}</p>
      <p><strong>你的作答：</strong>${escapeHtml(selectedDescription)}</p>
      ${!correct ? `<p><strong>错误提示：</strong>${wrongChoices.length ? `错选 ${escapeHtml(wrongChoices.map(labelFor).join('、'))}。` : ''}${missedChoices.length ? ` 漏选 ${escapeHtml(missedChoices.map(labelFor).join('、'))}。` : ''}</p>` : ''}
      <p><strong>答案解析：</strong>${escapeHtml(explanation || sourceNote)}</p>
    </div>
  </div>`;
}
function renderCard() {
  const card = $('#questionCard');
  card.classList.remove('exit-left', 'exit-right');
  const q = currentQuestion();
  const moduleRemaining = questions.filter(item => item.type === activeType && recordFor(item.id).status !== 'known').length;
  $('#modeText').textContent = `${mode === 'random' ? '随机练习' : '顺序练习'} · 第 ${round} 轮`;
  $('#sessionText').textContent = q ? `本轮已过 ${viewed} 题 · 本模块待掌握 ${moduleRemaining} 题` : '当前范围没有待练习题目';
  $('#progressFill').style.width = q ? `${Math.min(100, Math.round(viewed / Math.max(1, viewed + queue.length + 1) * 100))}%` : '100%';
  $('#knownBtn').disabled = !q || !answered;
  $('#unknownBtn').disabled = !q || !answered;
  if (!q) {
    const message = scope === 'wrong' ? '还没有需要强化的错题' : scope === 'unseen' ? '尚未作答的题目已经刷完' : '太棒了，待掌握题目已经清空';
    card.innerHTML = `<div class="empty-state"><div class="empty-icon">✓</div><h3>${message}</h3><p>${scope === 'remaining' ? '所有题目都已记住。你可以重置进度重新刷题。' : '切换到「全部待掌握」继续练习。'}</p>${scope !== 'remaining' ? '<button id="showAllBtn">查看全部待掌握</button>' : ''}</div>`;
    $('#showAllBtn')?.addEventListener('click', () => { scope = 'remaining'; $('#scopeSelect').value = scope; buildQueue(); });
    return;
  }
  const typeName = q.type === 'multiple' ? '多选题' : q.type === 'judgment' ? '判断题' : '单选题';
  card.innerHTML = `<div class="card-head"><span class="pill">${typeName} · 第 ${escapeHtml(q.number)} 题</span><span class="source-page">原 PDF 第 ${q.sourcePage} 页</span></div>
    <h3 class="question-title">${escapeHtml(q.stem)}</h3><div class="option-list">${q.options.map(o => renderOption(q, o)).join('')}</div>
    ${q.type === 'multiple' && !answered ? `<div class="submit-row"><button class="submit-btn" id="submitAnswer" ${selected.size ? '' : 'disabled'}>确认答案</button></div>` : ''}
    ${answered ? renderFeedback(q) : ''}`;
  card.querySelectorAll('[data-option]').forEach(button => button.addEventListener('click', () => choose(button.dataset.option)));
  $('#submitAnswer')?.addEventListener('click', submit);
}
function renderOverview() {
  const s = stats();
  const accuracyAttempts = Object.values(records).reduce((sum, r) => sum + (r.attempts || 0), 0);
  const wrongAttempts = Object.values(records).reduce((sum, r) => sum + (r.wrong || 0), 0);
  const accuracy = accuracyAttempts ? Math.round((accuracyAttempts - wrongAttempts) / accuracyAttempts * 100) : 0;
  $('#overviewContent').innerHTML = `<div class="overview-card"><h3>掌握进度 ${Math.round(s.known / Math.max(1, s.total) * 100)}%</h3><p>坚持把熟悉的题标记为「已记住」，待掌握池会越来越小。</p><div class="overview-progress"><span style="width:${s.known / Math.max(1, s.total) * 100}%"></span></div></div><div class="overview-card"><h3>练习记录</h3><div class="overview-row"><span>已作答题目</span><strong>${s.attempted} / ${s.total}</strong></div><div class="overview-row"><span>累计答题次数</span><strong>${accuracyAttempts}</strong></div><div class="overview-row"><span>累计正确率</span><strong>${accuracy}%</strong></div><div class="overview-row"><span>待强化错题</span><strong>${s.wrong}</strong></div></div>`;
}
function render() { renderStats(); renderCard(); renderOverview(); }
function choose(key) {
  const q = currentQuestion();
  if (!q || answered || !key) return;
  if (q.type === 'multiple') { selected.has(key) ? selected.delete(key) : selected.add(key); renderCard(); }
  else { selected = new Set([key]); submit(); }
}
function submit() {
  const q = currentQuestion();
  if (!q || answered || !selected.size) return;
  answered = true;
  const correct = q.answer.length === selected.size && q.answer.every(a => selected.has(a));
  const previous = recordFor(q.id);
  records[q.id] = { ...previous, attempts: previous.attempts + 1, wrong: previous.wrong + (correct ? 0 : 1), lastAnswer: [...selected], lastCorrect: correct };
  save(); render();
}
function classify(status) {
  if (!answered || !currentId || transitioning) return;
  transitioning = true;
  const card = $('#questionCard');
  card.classList.add(status === 'known' ? 'exit-left' : 'exit-right');
  const classifiedId = currentId;
  transitionTimer = setTimeout(() => {
    records[classifiedId] = { ...recordFor(classifiedId), status };
    save(); viewed++; transitioning = false; nextCard();
    transitionTimer = null;
  }, 170);
}
function setView(view) {
  $('#practiceView').classList.toggle('hidden', view !== 'practice');
  $('#overviewView').classList.toggle('hidden', view !== 'overview');
  $('#pageTitle').textContent = view === 'practice' ? '开始刷题' : '学习概览';
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view));
}
function bind() {
  document.querySelectorAll('[data-type]').forEach(button => button.addEventListener('click', () => {
    activeType = button.dataset.type;
    document.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('active', b === button));
    round = 1; buildQueue();
  }));
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('selected', b === button));
    round = 1; buildQueue();
  }));
  $('#scopeSelect').addEventListener('change', event => { scope = event.target.value; round = 1; buildQueue(); });
  $('#knownBtn').addEventListener('click', () => classify('known'));
  $('#unknownBtn').addEventListener('click', () => classify('unknown'));
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  $('#resetBtn').addEventListener('click', () => $('#resetDialog').showModal());
  $('#cancelReset').addEventListener('click', () => $('#resetDialog').close());
  $('#confirmReset').addEventListener('click', () => { records = {}; save(); round = 1; $('#resetDialog').close(); buildQueue(); });
  document.addEventListener('keydown', event => {
    if ($('#resetDialog').open || event.altKey || event.ctrlKey || event.metaKey) return;
    const q = currentQuestion();
    if (!q || document.activeElement?.tagName === 'SELECT') return;
    if (/^[1-4]$/.test(event.key) && !answered) choose(q.options[Number(event.key) - 1]?.key);
    else if (event.key === 'Enter' && q.type === 'multiple' && !answered) submit();
    else if (event.key === 'ArrowLeft' && answered) classify('known');
    else if (event.key === 'ArrowRight' && answered) classify('unknown');
  });
  const card = $('#questionCard');
  card.addEventListener('touchstart', event => { touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }, { passive: true });
  card.addEventListener('touchend', event => {
    if (!touchStart || !answered) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(dx) > 75 && Math.abs(dx) > Math.abs(dy) * 1.4) classify(dx < 0 ? 'known' : 'unknown');
    touchStart = null;
  }, { passive: true });
}
async function init() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    questions = await response.json();
    if (!Array.isArray(questions) || !questions.length) throw new Error('题库为空');
    load(); bind(); buildQueue();
  } catch (error) {
    $('#questionCard').innerHTML = `<div class="empty-state"><div class="empty-icon">!</div><h3>题库加载失败</h3><p>${escapeHtml(error.message)}。请通过本地服务器打开此网页。</p></div>`;
  }
}
init();
