import { providers, getSettings, saveSettings, setAiProfile, chat, listModels, explainQuestion } from './ai.js';
import { loadBank, saveBank, readMaterial, normalizeQuestions, aiImport } from './imports.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SUBJECTS = { psychology: '教育心理学', education: '教育学' };
const PROFILE_KEY = 'zcq-profiles-v1';
const ACTIVE_PROFILE_KEY = 'zcq-active-profile-v1';
let builtIn = [], builtInEducation = [], papers = [], imported = [], questions = [], records = {};
let importedBanks = { psychology: [], education: [] };
let profiles = [], profileId = '', subject = 'psychology', view = 'practice';
let type = 'single', mode = 'sequential', scope = 'remaining', queue = [], currentId = null, selected = new Set(), answered = false, round = 1, viewed = 0;
let transitioning = false, transitionTimer = null, importDraft = [], draftSubject = null, explanationState = null;
let duplicateDecisions = new Map();
let history = [], forward = [];
const explanationCache = new Map();

function recordKey() { return `zcq-progress-v2:${profileId}:${subject}`; }
function prefsKey() { return `zcq-prefs-v1:${profileId}`; }
function savePrefs() { localStorage.setItem(prefsKey(), JSON.stringify({ subject, type, mode, scope })); }
function loadPrefs() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(prefsKey()) || '{}') || {}; } catch { /* ignore */ }
  subject = SUBJECTS[saved.subject] ? saved.subject : 'psychology';
  type = ['single', 'multiple', 'judgment'].includes(saved.type) ? saved.type : 'single';
  mode = ['sequential', 'random'].includes(saved.mode) ? saved.mode : 'sequential';
  scope = ['remaining', 'wrong', 'unseen', 'reviewed'].includes(saved.scope) ? saved.scope : 'remaining';
}
function renderControls() {
  $('#scopeSelect').value = scope;
  document.querySelectorAll('[data-type]').forEach(button => button.classList.toggle('active', button.dataset.type === type));
  document.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('selected', button.dataset.mode === mode));
}
function sessionKey() { return `zcq-session-v1:${profileId}:${subject}:${type}:${mode}:${scope}`; }
function saveSession() {
  localStorage.setItem(sessionKey(), JSON.stringify({
    currentId, queue, round, viewed, selected: [...selected], answered,
    explanationState: explanationState?.status === 'done' && explanationState.details ? explanationState : null,
    history, forward
  }));
}
function clearSessions() {
  const prefix = `zcq-session-v1:${profileId}:${subject}:`;
  for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) localStorage.removeItem(key);
}
function loadRecords() {
  try { records = JSON.parse(localStorage.getItem(recordKey()) || '{}') || {}; } catch { records = {}; }
  if (profileId === 'default' && subject === 'psychology' && !localStorage.getItem(recordKey())) {
    try { records = JSON.parse(localStorage.getItem('edu-psychology-review-v1') || '{}') || {}; saveRecords(); } catch { /* ignore */ }
  }
}
function saveRecords() { localStorage.setItem(recordKey(), JSON.stringify(records)); }
function recordFor(id) { return records[id] || { status: 'new', attempts: 0, wrong: 0 }; }
function initProfiles() {
  try { profiles = JSON.parse(localStorage.getItem(PROFILE_KEY) || '[]'); } catch { profiles = []; }
  if (!Array.isArray(profiles) || !profiles.length) profiles = [{ id: 'default', name: '我的学习' }];
  profileId = localStorage.getItem(ACTIVE_PROFILE_KEY) || profiles[0].id;
  if (!profiles.some(item => item.id === profileId)) profileId = profiles[0].id;
  saveProfiles(); renderProfiles(); loadPrefs();
}
function saveProfiles() { localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles)); localStorage.setItem(ACTIVE_PROFILE_KEY, profileId); }
function renderProfiles() { $('#profileSelect').innerHTML = profiles.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join(''); $('#profileSelect').value = profileId; }
function eligible(q) {
  if (q.type !== type) return false;
  if (scope === 'reviewed') return recordFor(q.id).attempts > 0;
  if (recordFor(q.id).status === 'known') return false;
  if (scope === 'wrong') return recordFor(q.id).wrong > 0;
  if (scope === 'unseen') return recordFor(q.id).attempts === 0;
  return true;
}
function shuffle(items) { const a = [...items]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function buildQueue(resume = true) {
  if (transitionTimer) clearTimeout(transitionTimer);
  transitioning = false; transitionTimer = null;
  const ids = questions.filter(eligible).map(q => q.id);
  if (resume) {
    try {
      const state = JSON.parse(localStorage.getItem(sessionKey()) || 'null');
      if (state && (state.currentId === null || questions.some(q => q.id === state.currentId && q.type === type)) && Array.isArray(state.queue)) {
        const valid = new Set(questions.filter(q => q.type === type).map(q => q.id));
        history = Array.isArray(state.history) ? state.history.filter(item => valid.has(item.id)) : [];
        forward = Array.isArray(state.forward) ? state.forward.filter(item => valid.has(item.id)) : [];
        currentId = state.currentId; selected = new Set(state.selected || []); answered = !!state.answered;
        explanationState = state.explanationState?.details ? state.explanationState : null;
        round = Number(state.round) || 1; viewed = Number(state.viewed) || 0;
        const seen = new Set([currentId, ...state.queue, ...history.map(item => item.id), ...forward.map(item => item.id)]);
        queue = state.queue.filter(id => valid.has(id) && eligible(questions.find(q => q.id === id)));
        queue.push(...ids.filter(id => !seen.has(id)));
        if (!currentId && queue.length) currentId = queue.shift();
        render(); saveSession(); return;
      }
    } catch { /* build fresh queue */ }
  }
  queue = mode === 'random' ? shuffle(ids) : ids;
  history = []; forward = [];
  viewed = 0; currentId = queue.shift() || null; selected = new Set(); answered = false; explanationState = null; hydrateReviewCard(); render(); saveSession();
}
function snapshot() {
  return { id: currentId, selected: [...selected], answered, explanationState, round, viewed, statusBefore: recordFor(currentId).status };
}
function hydrateReviewCard() {
  if (scope !== 'reviewed' || !currentId) return;
  const lastAnswer = recordFor(currentId).lastAnswer;
  if (Array.isArray(lastAnswer) && lastAnswer.length) {
    selected = new Set(lastAnswer); answered = true;
  }
}
function restoreCard(item) {
  currentId = item.id; selected = new Set(item.selected); answered = item.answered;
  explanationState = item.explanationState?.details ? item.explanationState : null; round = item.round; viewed = item.viewed;
  render(); saveSession();
}
function nextCard() {
  if (forward.length) { restoreCard(forward.pop()); return; }
  let next = queue.shift();
  if (!next) {
    const ids = questions.filter(eligible).map(q => q.id);
    if (!ids.length) { currentId = null; render(); saveSession(); return; }
    round++; queue = mode === 'random' ? shuffle(ids) : ids; next = queue.shift(); viewed = 0;
  }
  currentId = next; selected = new Set(); answered = false; explanationState = null; hydrateReviewCard(); render(); saveSession();
}
function previousCard() {
  if (!history.length || transitioning) return;
  if (currentId) forward.push(snapshot());
  const previous = history.pop();
  if (recordFor(previous.id).status !== previous.statusBefore) {
    records[previous.id] = { ...recordFor(previous.id), status: previous.statusBefore };
    saveRecords();
  }
  restoreCard(previous);
}
function skipNext() {
  if (!currentId || transitioning) return;
  history.push(snapshot()); viewed++; nextCard();
}
function stats() {
  const known = questions.filter(q => recordFor(q.id).status === 'known').length;
  return { total: questions.length, known, remaining: questions.length - known,
    wrong: questions.filter(q => recordFor(q.id).wrong > 0 && recordFor(q.id).status !== 'known').length,
    attempted: questions.filter(q => recordFor(q.id).attempts > 0).length };
}
function mergeQuestions(base, local) {
  const merged = [...base], bySignature = new Map(), byId = new Map();
  const signature = q => `${q.type}:${String(q.stem).replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()}`;
  merged.forEach((q, index) => { bySignature.set(signature(q), index); byId.set(q.id, index); });
  for (const q of local) {
    const sameId = byId.get(q.id), sameStem = q.keepDuplicate ? undefined : bySignature.get(signature(q));
    const index = sameId ?? sameStem;
    if (index === undefined) { byId.set(q.id, merged.length); bySignature.set(signature(q), merged.length); merged.push(q); }
    else { merged[index] = q; byId.set(q.id, index); }
  }
  return merged;
}
function renderStats() {
  const s = stats();
  $('#statTotal').textContent = s.total; $('#statRemaining').textContent = s.remaining;
  $('#statKnown').textContent = s.known; $('#statWrong').textContent = s.wrong; $('#navRemaining').textContent = s.remaining;
  for (const item of ['single', 'multiple', 'judgment']) $(`#${item}Count`).textContent = `${questions.filter(q => q.type === item).length} 题`;
  const psychologyCount = mergeQuestions(builtIn, importedBanks.psychology).length;
  const educationCount = mergeQuestions(builtInEducation, importedBanks.education).length;
  $('#psychologyBankCount').textContent = `${psychologyCount} 题`;
  $('#educationBankCount').textContent = educationCount ? `${educationCount} 题` : '待导入';
}
function currentQuestion() { return questions.find(q => q.id === currentId); }
function answerText(q) { return q.type === 'judgment' ? (q.answer[0] === 'T' ? '正确' : '错误') : q.answer.join('、'); }
function optionLabel(q, key) { const item = q.options.find(o => o.key === key); return item ? `${key}「${item.text}」` : key; }
function renderOption(q, o) {
  const chosen = selected.has(o.key), correct = q.answer.includes(o.key);
  const className = answered ? (correct ? 'correct' : chosen ? 'incorrect' : '') : chosen ? 'selected' : '';
  const label = o.key === 'T' ? '✓' : o.key === 'F' ? '×' : o.key;
  return `<button class="option ${className}" data-option="${esc(o.key)}" ${answered ? 'disabled' : ''} aria-pressed="${chosen}"><span class="letter">${esc(label)}</span><span>${esc(o.text)}</span></button>`;
}
function renderFeedback(q) {
  const correct = q.answer.length === selected.size && q.answer.every(a => selected.has(a));
  const details = explanationState?.status === 'done' && q.options.every(o => explanationState.details?.[o.key])
    ? explanationState.details : q.optionExplanations;
  const analysis = details && q.options.every(o => details[o.key])
    ? `<div class="option-analysis"><strong>逐项解析</strong>${q.options.map(o => `<div class="analysis-row ${q.answer.includes(o.key) ? 'is-correct' : 'is-wrong'}"><b>${esc(o.key)}</b><span>${esc(details[o.key])}</span></div>`).join('')}</div>` : '';
  let aiHtml = analysis;
  if (explanationState?.status === 'loading') aiHtml += `<div class="stream-analysis"><strong>AI 正在逐项解析…</strong>${explanationState.text ? `<div class="stream-text">${esc(explanationState.text)}</div>` : ''}</div>`;
  else if (explanationState?.status === 'error') aiHtml += `<p class="error-message">AI 解析失败：${esc(explanationState.text)} <button id="retryExplainBtn" class="text-btn">重试</button></p>`;
  else if (!analysis && !getSettings().apiKey) aiHtml = '<p class="ai-message">想看四个选项各自的原因？<button id="openAiSettingsBtn" class="text-btn">设置 AI Key</button></p>';
  else if (!analysis) aiHtml = '<button id="retryExplainBtn" class="text-btn">生成逐项解析</button>';
  return `<div class="feedback"><div class="feedback-header ${correct ? 'good' : 'bad'}"><span>${correct ? '✓' : '✗'}</span>${correct ? '回答正确' : '回答有误'}</div><div class="feedback-detail">
    <p class="answer-label"><strong>正确答案：</strong>${esc(answerText(q))} · ${esc(q.answer.map(a => optionLabel(q, a)).join('、'))}</p>
    ${q.explanation ? `<p><strong>资料校对说明：</strong>${esc(q.explanation)}</p>` : ''}
    ${aiHtml}</div></div>`;
}
function renderCard() {
  const card = $('#questionCard'); card.classList.remove('exit-left', 'exit-right');
  const q = currentQuestion();
  // 进度是当前科目级别的历史累计，不随单选/多选/判断切换清零。
  // 出题队列仍按当前题型筛选，但顶部统计回答过的题覆盖本学科全部题型。
  const moduleQuestions = questions;
  const total = moduleQuestions.length;
  const practiced = moduleQuestions.filter(item => recordFor(item.id).attempts > 0).length;
  const unseen = total - practiced;
  const remaining = moduleQuestions.filter(item => recordFor(item.id).status !== 'known').length;
  $('#modeText').textContent = `${mode === 'random' ? '随机' : '顺序'}练习 · 第 ${round} 轮`;
  $('#sessionText').textContent = `本学科历史已刷 ${practiced} / ${total} 题 · 未刷 ${unseen} 题 · 待掌握 ${remaining} 题`;
  $('#progressFill').style.width = `${Math.round(practiced / Math.max(1, total) * 100)}%`;
  $('#knownBtn').disabled = !q || !answered; $('#unknownBtn').disabled = !q || !answered;
  $('#prevBtn').disabled = !history.length;
  $('#nextBtn').disabled = !q;
  if (!q) {
    card.innerHTML = `<div class="empty-state"><div class="empty-icon">${questions.length ? '✓' : '⇧'}</div><h3>${questions.length ? '当前范围已刷完' : '这门科目还没有题目'}</h3><p>${questions.length ? '切换题型或范围继续练习。' : '请先到“导入资料”添加教育学题目。'}</p><button id="emptyActionBtn">${questions.length ? '查看全部待掌握' : '去导入资料'}</button></div>`;
    $('#emptyActionBtn').onclick = () => { if (questions.length) { scope = 'remaining'; $('#scopeSelect').value = scope; buildQueue(); } else setView('import'); };
    return;
  }
  const typeName = q.type === 'multiple' ? '多选题' : q.type === 'judgment' ? '判断题' : '单选题';
  card.innerHTML = `<div class="card-head"><span class="pill">${typeName} · 第 ${esc(q.number)} 题</span><span class="source-page">题目来源：ZCQ</span></div>
    <h3 class="question-title">${esc(q.stem)}</h3><div class="option-list">${q.options.map(o => renderOption(q, o)).join('')}</div>
    ${q.type === 'multiple' && !answered ? `<div class="submit-row"><button class="submit-btn" id="submitAnswer" ${selected.size ? '' : 'disabled'}>确认答案</button></div>` : ''}
    ${answered ? renderFeedback(q) : ''}${answered && scope === 'reviewed' ? '<button id="retryAnswerBtn" class="retry-answer">重新作答</button>' : ''}`;
  card.querySelectorAll('[data-option]').forEach(button => button.onclick = () => choose(button.dataset.option));
  $('#submitAnswer')?.addEventListener('click', submit);
  $('#retryExplainBtn')?.addEventListener('click', generateExplanation);
  $('#openAiSettingsBtn')?.addEventListener('click', () => setView('settings'));
  $('#retryAnswerBtn')?.addEventListener('click', () => { selected = new Set(); answered = false; explanationState = null; renderCard(); saveSession(); });
}
function renderOverview() {
  const s = stats();
  const attempts = Object.values(records).reduce((sum, r) => sum + (r.attempts || 0), 0);
  const wrongAttempts = Object.values(records).reduce((sum, r) => sum + (r.wrong || 0), 0);
  const reviewed = questions.filter(q => recordFor(q.id).attempts > 0);
  $('#overviewContent').innerHTML = `<div class="overview-card"><h3>${esc(SUBJECTS[subject])} · 掌握进度 ${Math.round(s.known / Math.max(1, s.total) * 100)}%</h3><p>当前学习账号：${esc(profiles.find(p => p.id === profileId)?.name)}</p><div class="overview-progress"><span style="width:${s.known / Math.max(1, s.total) * 100}%"></span></div></div><div class="overview-card"><h3>练习记录</h3><div class="overview-row"><span>已作答题目</span><strong>${s.attempted} / ${s.total}</strong></div><div class="overview-row"><span>累计作答次数</span><strong>${attempts}</strong></div><div class="overview-row"><span>累计正确率</span><strong>${attempts ? Math.round((attempts - wrongAttempts) / attempts * 100) : 0}%</strong></div><div class="overview-row"><span>待强化错题</span><strong>${s.wrong}</strong></div></div><div class="overview-card"><h3>已刷题目 · ${reviewed.length}</h3><p>点击题目查看上次作答与答案。也可以在练习范围里选择“已刷题回看”。</p><div class="review-list">${reviewed.length ? reviewed.map(q => `<button class="review-link" data-review-id="${esc(q.id)}"><span class="review-type">${q.type === 'single' ? '单选' : q.type === 'multiple' ? '多选' : '判断'}</span><span>${esc(q.stem)}</span><small>${recordFor(q.id).status === 'known' ? '已记住' : '待掌握'}</small></button>`).join('') : '<p>还没有已刷题目。</p>'}</div></div>`;
  $('#overviewContent').querySelectorAll('[data-review-id]').forEach(button => button.onclick = () => openReviewedQuestion(button.dataset.reviewId));
}
function renderPapers() {
  $('#papersContent').innerHTML = papers.map(paper => `<div class="paper-card"><h3>真题卷 ${paper.number}</h3><p>${esc(paper.title)} · 共 ${paper.items.length} 道题</p>${paper.items.map(item => `<details class="paper-item"><summary><span class="paper-section">${esc(item.section)}</span><span>${esc(item.paragraphs[0])}</span></summary><div class="paper-body">${item.paragraphs.slice(1).map(line => `<p>${esc(line)}</p>`).join('')}</div></details>`).join('')}</div>`).join('');
}
function openReviewedQuestion(id) {
  const q = questions.find(item => item.id === id);
  if (!q) return;
  type = q.type; scope = 'reviewed'; savePrefs(); renderControls();
  buildQueue(false);
  queue = queue.filter(item => item !== id);
  currentId = id; selected = new Set(recordFor(id).lastAnswer || []); answered = selected.size > 0;
  explanationState = null; render(); saveSession(); setView('practice');
}
function render() { renderStats(); renderCard(); renderOverview(); }
function choose(key) {
  const q = currentQuestion(); if (!q || answered || !key) return;
  if (q.type === 'multiple') { selected.has(key) ? selected.delete(key) : selected.add(key); renderCard(); saveSession(); }
  else { selected = new Set([key]); submit(); }
}
function submit() {
  const q = currentQuestion(); if (!q || answered || !selected.size) return;
  answered = true;
  const correct = q.answer.length === selected.size && q.answer.every(a => selected.has(a));
  const previous = recordFor(q.id);
  records[q.id] = { ...previous, attempts: previous.attempts + 1, wrong: previous.wrong + (correct ? 0 : 1), lastAnswer: [...selected], lastCorrect: correct };
  saveRecords(); render(); saveSession();
  if (getSettings().apiKey) generateExplanation();
}
async function generateExplanation() {
  const q = currentQuestion(); if (!q || !answered) return;
  const id = currentId, selection = [...selected], requestProfile = profileId, requestSubject = subject;
  const settings = getSettings(), cacheKey = `${requestProfile}:${settings.baseUrl}:${settings.model}:${q.id}:${selection.join(',')}`;
  if (explanationCache.has(cacheKey)) { explanationState = { status: 'done', details: explanationCache.get(cacheKey) }; renderCard(); return; }
  explanationState = { status: 'loading' }; renderCard();
  try {
    let lastPaint = 0;
    const details = await explainQuestion(q, selection, partial => {
      if (currentId !== id || profileId !== requestProfile || subject !== requestSubject || !answered) return;
      explanationState = { status: 'loading', text: partial };
      if (performance.now() - lastPaint > 70) { renderCard(); lastPaint = performance.now(); }
    });
    explanationCache.set(cacheKey, details);
    if (currentId === id && profileId === requestProfile && subject === requestSubject && answered) { explanationState = { status: 'done', details }; renderCard(); saveSession(); }
  } catch (error) {
    if (currentId === id && profileId === requestProfile && subject === requestSubject && answered) { explanationState = { status: 'error', text: aiErrorMessage(error) }; renderCard(); }
  }
}
function classify(status) {
  if (!answered || !currentId || transitioning) return;
  transitioning = true; $('#questionCard').classList.add(status === 'known' ? 'exit-left' : 'exit-right');
  const id = currentId;
  const previous = snapshot();
  transitionTimer = setTimeout(() => { history.push(previous); records[id] = { ...recordFor(id), status }; saveRecords(); viewed++; transitioning = false; transitionTimer = null; nextCard(); }, 170);
}
function setView(next) {
  view = next;
  for (const name of ['practice', 'overview', 'papers', 'import', 'settings']) $(`#${name}View`).classList.toggle('hidden', name !== next);
  $('#pageTitle').textContent = ({ practice: '开始刷题', overview: '学习概览', papers: '教育学真题卷', import: '导入资料', settings: 'AI 设置' })[next];
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === next));
}
async function switchContext() {
  setAiProfile(profileId); fillSettings();
  renderControls();
  const [psychologyBank, educationBank] = await Promise.all([loadBank('psychology'), loadBank('education')]);
  importedBanks = { psychology: psychologyBank, education: educationBank };
  imported = importedBanks[subject];
  questions = mergeQuestions(subject === 'psychology' ? builtIn : builtInEducation, imported);
  loadRecords(); round = 1; buildQueue();
  for (const element of document.querySelectorAll('[data-subject]')) element.classList.toggle('active', element.dataset.subject === subject);
  $('#papersNav').classList.toggle('hidden', subject !== 'education');
  if (subject !== 'education' && view === 'papers') setView('practice');
  for (const id of ['heroSubject', 'practiceSubject', 'importSubject']) $(`#${id}`).textContent = SUBJECTS[subject];
  $('#importPreview').classList.add('hidden'); importDraft = []; draftSubject = null;
}
function renderModels(preset, selected = '') {
  const models = providers[preset]?.models || [];
  $('#modelSelect').innerHTML = '<option value="">手动输入模型 ID</option>' + models.map(model => `<option value="${esc(model)}">${esc(model)}</option>`).join('');
  $('#modelSelect').value = models.includes(selected) ? selected : '';
  $('#customModelInput').value = models.includes(selected) ? '' : selected;
}
function fillSettings() {
  const s = getSettings();
  $('#providerSelect').value = s.provider; $('#baseUrlInput').value = s.baseUrl;
  renderModels(s.provider, s.model); $('#apiKeyInput').value = s.apiKey; $('#rememberKey').checked = s.remember;
}
function persistSettings() {
  const model = $('#customModelInput').value.trim() || $('#modelSelect').value;
  saveSettings({ provider: $('#providerSelect').value, baseUrl: $('#baseUrlInput').value.trim(),
    model, apiKey: $('#apiKeyInput').value.trim(), remember: $('#rememberKey').checked });
  $('#aiStatus').textContent = `已保存，当前模型：${getSettings().model || '未选择'}`;
}
function aiErrorMessage(error) {
  const message = String(error?.message || error);
  if (getSettings().provider === 'siliconflow' && /余额|欠费|代金券|insufficient.balance|arrears|overdue/i.test(message))
    return `${message}。这是硅基流动账号返回的计费限制；请到其控制台核对欠费与代金券适用范围。`;
  return message;
}
function renderImportPreview() {
  const container = $('#importPreview');
  container.classList.remove('hidden');
  const count = kind => importDraft.filter(q => q.type === kind).length;
  const normalizeStem = stem => String(stem).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const similarity = (a, b) => {
    if (a === b) return 1;
    if (Math.min(a.length, b.length) / Math.max(a.length, b.length) < 0.75 || Math.min(a.length, b.length) < 8) return 0;
    const pairs = value => { const map = new Map(); for (let i = 0; i < value.length - 1; i++) { const pair = value.slice(i, i + 2); map.set(pair, (map.get(pair) || 0) + 1); } return map; };
    const left = pairs(a), right = pairs(b);
    let matches = 0; for (const [pair, amount] of left) matches += Math.min(amount, right.get(pair) || 0);
    return 2 * matches / Math.max(1, a.length + b.length - 2);
  };
  const duplicates = [];
  const pool = [...questions.map(q => ({ q, origin: '当前题库' }))];
  for (const q of importDraft) {
    const stem = normalizeStem(q.stem);
    let best = null;
    for (const item of pool) {
      if (item.q.type !== q.type) continue;
      const score = similarity(stem, normalizeStem(item.q.stem));
      if (score >= 0.88 && (!best || score > best.score)) best = { ...item, score };
      if (score === 1) break;
    }
    if (best) {
      if (!duplicateDecisions.has(q.id)) duplicateDecisions.set(q.id, 'remove');
      duplicates.push({ q, match: best.q, origin: best.origin, score: best.score });
    }
    pool.push({ q, origin: '本次资料' });
  }
  container.innerHTML = `<div class="form-card"><h3>预览：${importDraft.length} 题</h3><p>单选 ${count('single')} · 多选 ${count('multiple')} · 判断 ${count('judgment')}。可修正题型、答案或删除错误识别的题。</p>${duplicates.length ? `<div class="duplicate-panel"><h3>发现 ${duplicates.length} 道疑似重复题</h3><p>逐题比较新题与已有题。默认删除重复，你可以改为保留；答案冲突时请重点核对。</p>${duplicates.map(item => `<div class="duplicate-row"><div><strong>新题：</strong>${esc(item.q.stem)} <small>答案 ${esc(item.q.answer.join('、'))}</small><br /><strong>${esc(item.origin)}：</strong>${esc(item.match.stem)} <small>答案 ${esc(item.match.answer.join('、'))}</small> <small>相似度 ${Math.round(item.score * 100)}%</small>${item.q.answer.join(',') !== item.match.answer.join(',') ? '<b class="conflict">答案冲突，请核对</b>' : ''}</div><select data-duplicate="${esc(item.q.id)}"><option value="remove" ${duplicateDecisions.get(item.q.id) === 'remove' ? 'selected' : ''}>删除重复</option><option value="keep" ${duplicateDecisions.get(item.q.id) === 'keep' ? 'selected' : ''}>保留</option></select></div>`).join('')}</div>` : '<p class="no-duplicates">未发现疑似重复题。</p>'}<div class="preview-list">${importDraft.map((q, i) => `<div class="preview-item"><div><strong>${i + 1}. ${esc(q.stem)}</strong><p>${q.options.map(o => esc(`${o.key}. ${o.text}`)).join('　')}</p></div><select data-edit-type="${i}"><option value="single" ${q.type === 'single' ? 'selected' : ''}>单选</option><option value="multiple" ${q.type === 'multiple' ? 'selected' : ''}>多选</option><option value="judgment" ${q.type === 'judgment' ? 'selected' : ''}>判断</option></select><input data-edit-answer="${i}" aria-label="答案" value="${esc(q.answer.join(','))}" /><button class="text-btn" data-delete="${i}">删除</button></div>`).join('')}</div><div class="form-actions"><button id="confirmImportBtn" class="primary-btn">确认导入</button><span class="muted">当前科目：${esc(SUBJECTS[draftSubject])} · 重复题按上方选择处理</span></div></div>`;
  container.querySelectorAll('[data-duplicate]').forEach(el => el.onchange = () => duplicateDecisions.set(el.dataset.duplicate, el.value));
  container.querySelectorAll('[data-edit-type]').forEach(el => el.onchange = () => { importDraft[Number(el.dataset.editType)].type = el.value; renderImportPreview(); });
  container.querySelectorAll('[data-edit-answer]').forEach(el => el.onchange = () => { importDraft[Number(el.dataset.editAnswer)].answer = [...new Set(el.value.toUpperCase().match(/[A-Z]/g) || [])]; renderImportPreview(); });
  container.querySelectorAll('[data-delete]').forEach(el => el.onclick = () => { importDraft.splice(Number(el.dataset.delete), 1); renderImportPreview(); });
  $('#confirmImportBtn').onclick = confirmImport;
}
async function startImport() {
  const status = $('#importStatus'); const button = $('#startImportBtn');
  button.disabled = true; status.textContent = '正在读取资料…'; duplicateDecisions = new Map();
  try {
    const file = $('#materialFile').files[0];
    const material = file ? await readMaterial(file) : { text: $('#materialText').value };
    if (material.json) {
      const result = normalizeQuestions(material.json, subject);
      importDraft = result.questions;
      status.textContent = `识别 ${importDraft.length} 题；${result.rejected.length} 条无效数据已跳过。`;
    } else {
      const text = file ? material.text : $('#materialText').value;
      if (!getSettings().apiKey) throw new Error('文字资料需先到 AI 设置填写 API Key。题库 JSON 可直接导入。');
      importDraft = await aiImport(text, subject, message => status.textContent = message);
      status.textContent = `识别完成，共 ${importDraft.length} 题。请核对后导入。`;
    }
    if (!importDraft.length) throw new Error('没有识别出可导入的完整题目，请检查资料与答案。');
    draftSubject = subject; renderImportPreview(); $('#importPreview').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    if (error.partialQuestions?.length) {
      importDraft = error.partialQuestions; draftSubject = subject; renderImportPreview();
      status.textContent = `中途失败：${error.message}。已完成的 ${importDraft.length} 题可先核对导入；重新尝试可继续补充，重复题会跳过。`;
    } else status.textContent = `导入失败：${error.message}`;
  }
  finally { button.disabled = false; }
}
async function confirmImport() {
  if (draftSubject !== subject) { $('#importStatus').textContent = '科目已切换，请重新预览。'; return; }
  const invalid = importDraft.find(q => !q.answer.length || q.answer.some(a => !q.options.some(o => o.key === a)) || (q.type !== 'multiple' && q.answer.length !== 1));
  if (invalid) { $('#importStatus').textContent = `“${invalid.stem.slice(0, 20)}…” 的题型或答案无效，请修正。\n`; return; }
  const existing = await loadBank(subject);
  const fresh = importDraft.filter(q => duplicateDecisions.get(q.id) !== 'remove').map(q => ({
    ...q, ...(duplicateDecisions.get(q.id) === 'keep' ? { keepDuplicate: true } : {})
  }));
  await saveBank(subject, [...existing, ...fresh]);
  $('#importStatus').textContent = `已导入 ${fresh.length} 题，按你的选择删除 ${importDraft.length - fresh.length} 道重复题。`;
  $('#importPreview').classList.add('hidden'); importDraft = []; await switchContext(); setView('practice');
}
function bind() {
  $('#profileSelect').onchange = async event => { profileId = event.target.value; saveProfiles(); loadPrefs(); await switchContext(); };
  $('#addProfileBtn').onclick = async () => {
    const name = prompt('新学习账号名称（仅保存在这台设备上）：')?.trim();
    if (!name) return;
    const profile = { id: crypto.randomUUID(), name: name.slice(0, 30) };
    profiles.push(profile); profileId = profile.id; saveProfiles(); loadPrefs(); renderProfiles(); await switchContext();
  };
  document.querySelectorAll('[data-subject]').forEach(button => button.onclick = async () => { subject = button.dataset.subject; savePrefs(); await switchContext(); });
  document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => setView(button.dataset.view));
  document.querySelectorAll('[data-type]').forEach(button => button.onclick = () => { type = button.dataset.type; savePrefs(); renderControls(); round = 1; buildQueue(); });
  document.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => { mode = button.dataset.mode; savePrefs(); renderControls(); round = 1; buildQueue(); });
  $('#scopeSelect').onchange = event => { scope = event.target.value; savePrefs(); round = 1; buildQueue(); };
  $('#knownBtn').onclick = () => classify('known'); $('#unknownBtn').onclick = () => classify('unknown');
  $('#prevBtn').onclick = previousCard; $('#nextBtn').onclick = skipNext;
  $('#resetBtn').onclick = () => $('#resetDialog').showModal(); $('#cancelReset').onclick = () => $('#resetDialog').close();
  $('#confirmReset').onclick = () => { records = {}; saveRecords(); clearSessions(); scope = 'remaining'; savePrefs(); renderControls(); round = 1; $('#resetDialog').close(); buildQueue(false); };
  $('#providerSelect').onchange = event => { const preset = providers[event.target.value]; $('#baseUrlInput').value = preset.baseUrl; renderModels(event.target.value, preset.models[0]); persistSettings(); };
  $('#modelSelect').onchange = () => { if ($('#modelSelect').value) $('#customModelInput').value = ''; persistSettings(); };
  $('#customModelInput').onchange = persistSettings;
  $('#baseUrlInput').onchange = persistSettings;
  $('#saveAiBtn').onclick = persistSettings;
  $('#clearAiKeyBtn').onclick = () => { $('#apiKeyInput').value = ''; persistSettings(); $('#aiStatus').textContent = '本账号的 Key 已清除'; };
  $('#testAiBtn').onclick = async () => { persistSettings(); const s = getSettings(); $('#aiStatus').textContent = `正在测试 ${providers[s.provider].label} / ${s.model}…`; try { await chat([{ role: 'user', content: '只回答：连接成功' }]); $('#aiStatus').textContent = `${s.model} 连接成功`; } catch (error) { $('#aiStatus').textContent = `${s.model} 连接失败：${aiErrorMessage(error)}`; } };
  $('#refreshModelsBtn').onclick = async () => { persistSettings(); $('#aiStatus').textContent = '正在读取模型…'; try { const models = await listModels(); $('#modelSelect').innerHTML = '<option value="">手动输入模型 ID</option>' + models.map(model => `<option value="${esc(model)}">${esc(model)}</option>`).join(''); $('#aiStatus').textContent = `读取到 ${models.length} 个模型`; } catch (error) { $('#aiStatus').textContent = error.message; } };
  $('#materialFile').onchange = event => { $('#fileStatus').textContent = event.target.files[0]?.name || '尚未选择文件'; };
  $('#startImportBtn').onclick = startImport;
  $('#noticeAiBtn').onclick = () => setView('settings');
  $('#exportBankBtn').onclick = () => {
    const file = new Blob([JSON.stringify(questions, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file); link.download = subject === 'psychology' ? 'questions.json' : 'education.json';
    link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  document.addEventListener('keydown', event => {
    if (view !== 'practice' || $('#resetDialog').open || event.altKey || event.ctrlKey || event.metaKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    const q = currentQuestion(); if (!q) return;
    if (/^[1-4]$/.test(event.key) && !answered) choose(q.options[Number(event.key) - 1]?.key);
    else if (event.key === 'Enter' && q.type === 'multiple' && !answered) submit();
    else if (event.key === 'ArrowLeft' && answered) classify('known');
    else if (event.key === 'ArrowRight' && answered) classify('unknown');
  });
  let touchStart;
  $('#questionCard').addEventListener('touchstart', event => { touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }, { passive: true });
  $('#questionCard').addEventListener('touchend', event => { if (!touchStart || !answered) return; const dx = event.changedTouches[0].clientX - touchStart.x, dy = event.changedTouches[0].clientY - touchStart.y; if (Math.abs(dx) > 75 && Math.abs(dx) > Math.abs(dy) * 1.4) classify(dx < 0 ? 'known' : 'unknown'); touchStart = null; }, { passive: true });
}
async function init() {
  try {
    const response = await fetch('./data/questions.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    builtIn = await response.json();
    if (!Array.isArray(builtIn) || !builtIn.length) throw new Error('教育心理学题库为空');
    const educationResponse = await fetch('./data/education.json');
    if (educationResponse.ok) builtInEducation = await educationResponse.json();
    const papersResponse = await fetch('./data/education-papers.json');
    if (papersResponse.ok) papers = await papersResponse.json();
    const first = builtIn.find(q => q.id === 'single-1');
    if (first) first.optionExplanations = {
      A: '理想化与现实感的落差，是大学生认识现实与个人理想时常见的具体心理冲突，因此不选。',
      B: '交往需要与自我封闭相互拉扯，属于大学生人际发展中的具体心理冲突，因此不选。',
      C: '性生理成熟而性心理相对幼稚，反映身心发展不同步的具体冲突，因此不选。',
      D: '适应心理问题概括的是一类心理困扰，不像前三项那样表述两种倾向之间的具体冲突；题干问“不属于”，因此选 D。'
    };
    initProfiles(); bind(); fillSettings(); renderPapers(); await switchContext();
  } catch (error) {
    $('#questionCard').innerHTML = `<div class="empty-state"><h3>题库加载失败</h3><p>${esc(error.message)}</p></div>`;
  }
}
init();
