const students = [
  ['Абенова Аруна', 'Ученица'], ['Абылкасым Нурасыл', 'Ученик'], ['Айтимов Алдияр', 'Ученик'], ['Айтимов Алияр', 'Ученик'], ['Аширов Хангельды', 'Ученик'], ['Барков Марк', 'Ученик'], ['Демкина Мария', 'Ученица'], ['Ещанова Аружан', 'Ученица'], ['Зеленкин Денис', 'Ученик'], ['Какенова Тамирис', 'Ученица'], ['Ковалдин Дмитрий', 'Ученик'], ['Комратова Яна', 'Ученица'], ['Обозный Владислав', 'Ученик'], ['Оганесян Никита', 'Ученик'], ['Палинка Александр', 'Ученик'], ['Пристенная Екатерина', 'Ученица'], ['Сидиков Марсель', 'Ученик'], ['Смирнов Артём', 'Староста класса'], ['Сушко Надежда', 'Ученица'], ['Тагабергенова Томирис', 'Ученица'], ['Чернышов Родион', 'Заместитель старосты']
];
document.querySelector('#student-grid').innerHTML = students.map(([name, role]) => {
  const initials = name.split(' ').map(part => part[0]).join('').slice(0, 2);
  return `<article class="student"><span class="initials">${initials}</span><div><b>${name}</b><small>${role}</small></div></article>`;
}).join('');

const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница'];
const scheduleGrid = document.querySelector('#schedule-grid');
const blankEntries = () => Array.from({ length: 8 }, () => ({ subject: '', time: '', room: '' }));
const escapeHtml = value => String(value || '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
let saveTimeout;
const scheduleStorageKey = '9vclass-schedule';

function localSchedule() {
  try { return JSON.parse(localStorage.getItem(scheduleStorageKey) || '{}'); } catch { return {}; }
}

function renderSchedule(savedSchedule = {}) {
  scheduleGrid.innerHTML = days.map(day => {
    const entries = savedSchedule[day] || blankEntries();
    return `<article class="schedule-day-card"><h2>${day}</h2>${entries.map((entry, index) => `<div class="schedule-entry"><strong class="schedule-entry-number">${index + 1} урок</strong><input data-day="${day}" data-field="subject" data-index="${index}" value="${escapeHtml(entry.subject)}" placeholder="Предмет" aria-label="${day}, ${index + 1} урок, предмет"><input data-day="${day}" data-field="time" data-index="${index}" value="${escapeHtml(entry.time)}" placeholder="Время" aria-label="${day}, ${index + 1} урок, время"><input data-day="${day}" data-field="room" data-index="${index}" value="${escapeHtml(entry.room)}" placeholder="Кабинет" aria-label="${day}, ${index + 1} урок, кабинет"></div>`).join('')}</article>`;
  }).join('');
  document.querySelectorAll('.schedule-entry input').forEach(input => { input.readOnly = document.body.dataset.accessMode !== 'admin'; });
}

function collectSchedule() {
  const schedule = {};
  days.forEach(day => { schedule[day] = Array.from(scheduleGrid.querySelectorAll(`[data-day="${day}"][data-field="subject"]`)).map((subject, index) => ({ subject: subject.value, time: scheduleGrid.querySelector(`[data-day="${day}"][data-field="time"][data-index="${index}"]`).value, room: scheduleGrid.querySelector(`[data-day="${day}"][data-field="room"][data-index="${index}"]`).value })); });
  return schedule;
}

async function loadSchedule() {
  try {
    const response = await fetch('/api/schedule');
    if (!response.ok) throw new Error('schedule unavailable');
    const schedule = (await response.json()).schedule;
    localStorage.setItem(scheduleStorageKey, JSON.stringify(schedule));
    renderSchedule(schedule);
  } catch { renderSchedule(localSchedule()); }
}

scheduleGrid.addEventListener('input', () => {
  if (document.body.dataset.accessMode !== 'admin') return;
  const schedule = collectSchedule();
  localStorage.setItem(scheduleStorageKey, JSON.stringify(schedule));
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try { await fetch('/api/schedule', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ schedule }) }); } catch {}
  }, 500);
});

loadSchedule();

const pages = [...document.querySelectorAll('.page')];
const links = [...document.querySelectorAll('[data-page]')];
const menu = document.querySelector('.navigation');
const menuButton = document.querySelector('.menu-button');
function openPage() {
  const page = location.hash.slice(1) || 'home';
  const exists = pages.some(item => item.id === page);
  const activePage = exists ? page : 'home';
  pages.forEach(item => item.classList.toggle('active', item.id === activePage));
  links.forEach(link => link.classList.toggle('active', link.dataset.page === activePage));
  document.title = `${links.find(link => link.dataset.page === activePage)?.textContent || 'Главная'} — 9 «В» класс`;
  menu.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false');
  window.scrollTo({ top: 0, behavior: 'instant' });
}
menuButton.addEventListener('click', () => {
  const isOpen = menu.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
});
window.addEventListener('hashchange', openPage);
openPage();
