import { providers, getSettings, saveSettings, setAiProfile, chat, listModels, explainQuestion } from './ai.js';
import { loadBank, saveBank, readMaterial, normalizeQuestions, aiImport } from './imports.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SUBJECTS = { psychology: '教育心理学', education: '教育学' };
const PROFILE_KEY = 'zcq-profiles-v1';
const ACTIVE_PROFILE_KEY = 'zcq-active-profile-v1';
let builtIn = [], builtInEducation = [], imported = [], questions = [], records = {};
let profiles = [], profileId = '', subject = 'psychology', view = 'practice';
let type = 'single', mode = 'sequential', scope = 'remaining', queue = [], currentId = null, selected = new Set(), answered = false, round = 1, viewed = 0;
let transitioning = false, transitionTimer = null, importDraft = [], draftSubject = null, explanationState = null;
const explanationCache = new Map();

function recordKey() { return `zcq-progress-v2:${profileId}:${subject}`; }
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
  saveProfiles(); renderProfiles();
}
function saveProfiles() { localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles)); localStorage.setItem(ACTIVE_PROFILE_KEY, profileId); }
function renderProfiles() { $('#profileSelect').innerHTML = profiles.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join(''); $('#profileSelect').value = profileId; }
function eligible(q) {
  if (q.type !== type || recordFor(q.id).status === 'known') return false;
  if (scope === 'wrong') return recordFor(q.id).wrong > 0;
  if (scope === 'unseen') return recordFor(q.id).attempts === 0;
  return true;
}
function shuffle(items) { const a = [...items]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function buildQueue() {
  if (transitionTimer) clearTimeout(transitionTimer);
  transitioning = false; transitionTimer = null;
  const ids = questions.filter(eligible).map(q => q.id);
  queue = mode === 'random' ? shuffle(ids) : ids;
  viewed = 0; currentId = queue.shift() || null; selected = new Set(); answered = false; explanationState = null; render();
}
function nextCard() {
  let next = queue.shift();
  if (!next) {
    const ids = questions.filter(eligible).map(q => q.id);
    if (!ids.length) { currentId = null; render(); return; }
    round++; queue = mode === 'random' ? shuffle(ids) : ids; next = queue.shift(); viewed = 0;
  }
  currentId = next; selected = new Set(); answered = false; explanationState = null; render();
}
function stats() {
  const known = questions.filter(q => recordFor(q.id).status === 'known').length;
  return { total: questions.length, known, remaining: questions.length - known,
    wrong: questions.filter(q => recordFor(q.id).wrong > 0 && recordFor(q.id).status !== 'known').length,
    attempted: questions.filter(q => recordFor(q.id).attempts > 0).length };
}
function renderStats() {
  const s = stats();
  $('#statTotal').textContent = s.total; $('#statRemaining').textContent = s.remaining;
  $('#statKnown').textContent = s.known; $('#statWrong').textContent = s.wrong; $('#navRemaining').textContent = s.remaining;
  for (const item of ['single', 'multiple', 'judgment']) $(`#${item}Count`).textContent = `${questions.filter(q => q.type === item).length} 题`;
  $('#psychologyBankCount').textContent = subject === 'psychology' ? `${questions.length} 题` : `${builtIn.length} 题`;
  $('#educationBankCount').textContent = subject === 'education' ? (questions.length ? `${questions.length} 题` : '待导入') : (builtInEducation.length ? `${builtInEducation.length} 题` : '待导入');
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
  const wrong = [...selected].filter(a => !q.answer.includes(a));
  const missed = q.answer.filter(a => !selected.has(a));
  let aiHtml = '';
  if (explanationState?.status === 'loading') aiHtml = '<p class="ai-message">AI 正在分析这次作答…</p>';
  else if (explanationState?.status === 'done') aiHtml = `<p class="ai-message"><strong>针对性解析：</strong>${esc(explanationState.text)}</p>`;
  else if (explanationState?.status === 'error') aiHtml = `<p class="error-message">AI 解析失败：${esc(explanationState.text)} <button id="retryExplainBtn" class="text-btn">重试</button></p>`;
  else if (!getSettings().apiKey) aiHtml = '<p class="ai-message">想看针对具体选项的原因？<button id="openAiSettingsBtn" class="text-btn">设置 AI Key</button></p>';
  else aiHtml = '<button id="retryExplainBtn" class="text-btn">生成针对性解析</button>';
  return `<div class="feedback"><div class="feedback-header ${correct ? 'good' : 'bad'}"><span>${correct ? '✓' : '✗'}</span>${correct ? '回答正确' : '回答有误'}</div><div class="feedback-detail">
    <p class="answer-label"><strong>正确答案：</strong>${esc(answerText(q))} · ${esc(q.answer.map(a => optionLabel(q, a)).join('、'))}</p>
    <p><strong>你的作答：</strong>${esc([...selected].map(a => optionLabel(q, a)).join('、'))}</p>
    ${!correct ? `<p><strong>错误提示：</strong>${wrong.length ? `错选 ${esc(wrong.map(a => optionLabel(q, a)).join('、'))}。` : ''}${missed.length ? ` 漏选 ${esc(missed.map(a => optionLabel(q, a)).join('、'))}。` : ''}</p>` : ''}
    ${q.explanation ? `<p><strong>资料解析：</strong>${esc(q.explanation)}</p>` : ''}
    ${aiHtml}</div></div>`;
}
function renderCard() {
  const card = $('#questionCard'); card.classList.remove('exit-left', 'exit-right');
  const q = currentQuestion();
  const remaining = questions.filter(item => item.type === type && recordFor(item.id).status !== 'known').length;
  $('#modeText').textContent = `${mode === 'random' ? '随机' : '顺序'}练习 · 第 ${round} 轮`;
  $('#sessionText').textContent = q ? `本轮已过 ${viewed} 题 · 本模块待掌握 ${remaining} 题` : '当前范围没有待练习题目';
  $('#progressFill').style.width = q ? `${Math.round(viewed / Math.max(1, viewed + queue.length + 1) * 100)}%` : '100%';
  $('#knownBtn').disabled = !q || !answered; $('#unknownBtn').disabled = !q || !answered;
  if (!q) {
    card.innerHTML = `<div class="empty-state"><div class="empty-icon">${questions.length ? '✓' : '⇧'}</div><h3>${questions.length ? '当前范围已刷完' : '这门科目还没有题目'}</h3><p>${questions.length ? '切换题型或范围继续练习。' : '请先到“导入资料”添加教育学题目。'}</p><button id="emptyActionBtn">${questions.length ? '查看全部待掌握' : '去导入资料'}</button></div>`;
    $('#emptyActionBtn').onclick = () => { if (questions.length) { scope = 'remaining'; $('#scopeSelect').value = scope; buildQueue(); } else setView('import'); };
    return;
  }
  const typeName = q.type === 'multiple' ? '多选题' : q.type === 'judgment' ? '判断题' : '单选题';
  card.innerHTML = `<div class="card-head"><span class="pill">${typeName} · 第 ${esc(q.number)} 题</span><span class="source-page">题目来源：ZCQ</span></div>
    <h3 class="question-title">${esc(q.stem)}</h3><div class="option-list">${q.options.map(o => renderOption(q, o)).join('')}</div>
    ${q.type === 'multiple' && !answered ? `<div class="submit-row"><button class="submit-btn" id="submitAnswer" ${selected.size ? '' : 'disabled'}>确认答案</button></div>` : ''}
    ${answered ? renderFeedback(q) : ''}`;
  card.querySelectorAll('[data-option]').forEach(button => button.onclick = () => choose(button.dataset.option));
  $('#submitAnswer')?.addEventListener('click', submit);
  $('#retryExplainBtn')?.addEventListener('click', generateExplanation);
  $('#openAiSettingsBtn')?.addEventListener('click', () => setView('settings'));
}
function renderOverview() {
  const s = stats();
  const attempts = Object.values(records).reduce((sum, r) => sum + (r.attempts || 0), 0);
  const wrongAttempts = Object.values(records).reduce((sum, r) => sum + (r.wrong || 0), 0);
  $('#overviewContent').innerHTML = `<div class="overview-card"><h3>${esc(SUBJECTS[subject])} · 掌握进度 ${Math.round(s.known / Math.max(1, s.total) * 100)}%</h3><p>当前学习账号：${esc(profiles.find(p => p.id === profileId)?.name)}</p><div class="overview-progress"><span style="width:${s.known / Math.max(1, s.total) * 100}%"></span></div></div><div class="overview-card"><h3>练习记录</h3><div class="overview-row"><span>已作答题目</span><strong>${s.attempted} / ${s.total}</strong></div><div class="overview-row"><span>累计作答次数</span><strong>${attempts}</strong></div><div class="overview-row"><span>累计正确率</span><strong>${attempts ? Math.round((attempts - wrongAttempts) / attempts * 100) : 0}%</strong></div><div class="overview-row"><span>待强化错题</span><strong>${s.wrong}</strong></div></div>`;
}
function render() { renderStats(); renderCard(); renderOverview(); }
function choose(key) {
  const q = currentQuestion(); if (!q || answered || !key) return;
  if (q.type === 'multiple') { selected.has(key) ? selected.delete(key) : selected.add(key); renderCard(); }
  else { selected = new Set([key]); submit(); }
}
function submit() {
  const q = currentQuestion(); if (!q || answered || !selected.size) return;
  answered = true;
  const correct = q.answer.length === selected.size && q.answer.every(a => selected.has(a));
  const previous = recordFor(q.id);
  records[q.id] = { ...previous, attempts: previous.attempts + 1, wrong: previous.wrong + (correct ? 0 : 1), lastAnswer: [...selected], lastCorrect: correct };
  saveRecords(); render();
  if (getSettings().apiKey) generateExplanation();
}
async function generateExplanation() {
  const q = currentQuestion(); if (!q || !answered) return;
  const id = currentId, selection = [...selected], requestProfile = profileId, requestSubject = subject;
  const settings = getSettings(), cacheKey = `${requestProfile}:${settings.baseUrl}:${settings.model}:${q.id}:${selection.join(',')}`;
  if (explanationCache.has(cacheKey)) { explanationState = { status: 'done', text: explanationCache.get(cacheKey) }; renderCard(); return; }
  explanationState = { status: 'loading' }; renderCard();
  try {
    const text = await explainQuestion(q, selection);
    explanationCache.set(cacheKey, text);
    if (currentId === id && profileId === requestProfile && subject === requestSubject && answered) { explanationState = { status: 'done', text }; renderCard(); }
  } catch (error) {
    if (currentId === id && profileId === requestProfile && subject === requestSubject && answered) { explanationState = { status: 'error', text: error.message }; renderCard(); }
  }
}
function classify(status) {
  if (!answered || !currentId || transitioning) return;
  transitioning = true; $('#questionCard').classList.add(status === 'known' ? 'exit-left' : 'exit-right');
  const id = currentId;
  transitionTimer = setTimeout(() => { records[id] = { ...recordFor(id), status }; saveRecords(); viewed++; transitioning = false; transitionTimer = null; nextCard(); }, 170);
}
function setView(next) {
  view = next;
  for (const name of ['practice', 'overview', 'import', 'settings']) $(`#${name}View`).classList.toggle('hidden', name !== next);
  $('#pageTitle').textContent = ({ practice: '开始刷题', overview: '学习概览', import: '导入资料', settings: 'AI 设置' })[next];
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === next));
}
async function switchContext() {
  setAiProfile(profileId); fillSettings();
  imported = await loadBank(subject);
  questions = subject === 'psychology' ? [...builtIn, ...imported] : [...builtInEducation, ...imported];
  loadRecords(); round = 1; buildQueue();
  for (const element of document.querySelectorAll('[data-subject]')) element.classList.toggle('active', element.dataset.subject === subject);
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
  $('#aiStatus').textContent = '设置已保存';
}
function renderImportPreview() {
  const container = $('#importPreview');
  container.classList.remove('hidden');
  const count = kind => importDraft.filter(q => q.type === kind).length;
  container.innerHTML = `<div class="form-card"><h3>预览：${importDraft.length} 题</h3><p>单选 ${count('single')} · 多选 ${count('multiple')} · 判断 ${count('judgment')}。可修正题型、答案或删除错误识别的题。</p><div class="preview-list">${importDraft.map((q, i) => `<div class="preview-item"><div><strong>${i + 1}. ${esc(q.stem)}</strong><p>${q.options.map(o => esc(`${o.key}. ${o.text}`)).join('　')}</p></div><select data-edit-type="${i}"><option value="single" ${q.type === 'single' ? 'selected' : ''}>单选</option><option value="multiple" ${q.type === 'multiple' ? 'selected' : ''}>多选</option><option value="judgment" ${q.type === 'judgment' ? 'selected' : ''}>判断</option></select><input data-edit-answer="${i}" aria-label="答案" value="${esc(q.answer.join(','))}" /><button class="text-btn" data-delete="${i}">删除</button></div>`).join('')}</div><div class="form-actions"><button id="confirmImportBtn" class="primary-btn">确认导入 ${importDraft.length} 题</button><span class="muted">当前科目：${esc(SUBJECTS[draftSubject])}</span></div></div>`;
  container.querySelectorAll('[data-edit-type]').forEach(el => el.onchange = () => { importDraft[Number(el.dataset.editType)].type = el.value; });
  container.querySelectorAll('[data-edit-answer]').forEach(el => el.onchange = () => { importDraft[Number(el.dataset.editAnswer)].answer = [...new Set(el.value.toUpperCase().match(/[A-Z]/g) || [])]; });
  container.querySelectorAll('[data-delete]').forEach(el => el.onclick = () => { importDraft.splice(Number(el.dataset.delete), 1); renderImportPreview(); });
  $('#confirmImportBtn').onclick = confirmImport;
}
async function startImport() {
  const status = $('#importStatus'); const button = $('#startImportBtn');
  button.disabled = true; status.textContent = '正在读取资料…';
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
  const seen = new Set([...(subject === 'psychology' ? builtIn : builtInEducation), ...existing].map(q => `${q.type}:${q.stem.replace(/\s/g, '')}`));
  const fresh = importDraft.filter(q => { const key = `${q.type}:${q.stem.replace(/\s/g, '')}`; if (seen.has(key)) return false; seen.add(key); return true; });
  await saveBank(subject, [...existing, ...fresh]);
  $('#importStatus').textContent = `已导入 ${fresh.length} 题，跳过 ${importDraft.length - fresh.length} 道重复题。`;
  $('#importPreview').classList.add('hidden'); importDraft = []; await switchContext(); setView('practice');
}
function bind() {
  $('#profileSelect').onchange = async event => { profileId = event.target.value; saveProfiles(); await switchContext(); };
  $('#addProfileBtn').onclick = async () => {
    const name = prompt('新学习账号名称（仅保存在这台设备上）：')?.trim();
    if (!name) return;
    const profile = { id: crypto.randomUUID(), name: name.slice(0, 30) };
    profiles.push(profile); profileId = profile.id; saveProfiles(); renderProfiles(); await switchContext();
  };
  document.querySelectorAll('[data-subject]').forEach(button => button.onclick = async () => { subject = button.dataset.subject; await switchContext(); });
  document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => setView(button.dataset.view));
  document.querySelectorAll('[data-type]').forEach(button => button.onclick = () => { type = button.dataset.type; document.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('active', b === button)); round = 1; buildQueue(); });
  document.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => { mode = button.dataset.mode; document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('selected', b === button)); round = 1; buildQueue(); });
  $('#scopeSelect').onchange = event => { scope = event.target.value; round = 1; buildQueue(); };
  $('#knownBtn').onclick = () => classify('known'); $('#unknownBtn').onclick = () => classify('unknown');
  $('#resetBtn').onclick = () => $('#resetDialog').showModal(); $('#cancelReset').onclick = () => $('#resetDialog').close();
  $('#confirmReset').onclick = () => { records = {}; saveRecords(); round = 1; $('#resetDialog').close(); buildQueue(); };
  $('#providerSelect').onchange = event => { const preset = providers[event.target.value]; $('#baseUrlInput').value = preset.baseUrl; renderModels(event.target.value, preset.models[0]); };
  $('#modelSelect').onchange = () => { if ($('#modelSelect').value) $('#customModelInput').value = ''; };
  $('#saveAiBtn').onclick = persistSettings;
  $('#testAiBtn').onclick = async () => { persistSettings(); $('#aiStatus').textContent = '正在测试…'; try { await chat([{ role: 'user', content: '只回答：连接成功' }]); $('#aiStatus').textContent = '连接成功'; } catch (error) { $('#aiStatus').textContent = `连接失败：${error.message}`; } };
  $('#refreshModelsBtn').onclick = async () => { persistSettings(); $('#aiStatus').textContent = '正在读取模型…'; try { const models = await listModels(); $('#modelSelect').innerHTML = '<option value="">手动输入模型 ID</option>' + models.map(model => `<option value="${esc(model)}">${esc(model)}</option>`).join(''); $('#aiStatus').textContent = `读取到 ${models.length} 个模型`; } catch (error) { $('#aiStatus').textContent = error.message; } };
  $('#materialFile').onchange = event => { $('#fileStatus').textContent = event.target.files[0]?.name || '尚未选择文件'; };
  $('#startImportBtn').onclick = startImport;
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
    const first = builtIn.find(q => q.id === 'single-1');
    if (first) first.explanation = 'A“理想化与现实感”体现理想与现实的冲突；B“交往与闭锁”体现交往需要与自我封闭的冲突；C“性生理成熟与性心理相对幼稚”体现身心发展不同步的冲突。D“适应心理问题”是对一类问题的概括，并非与前三项并列的具体心理冲突，所以本题选 D。';
    initProfiles(); bind(); fillSettings(); await switchContext();
  } catch (error) {
    $('#questionCard').innerHTML = `<div class="empty-state"><h3>题库加载失败</h3><p>${esc(error.message)}</p></div>`;
  }
}
init();
