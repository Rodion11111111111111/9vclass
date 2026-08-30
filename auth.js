const authOverlay = document.querySelector('.auth-overlay');
const authTitle = document.querySelector('#auth-title');
const authDescription = document.querySelector('#auth-description');
const authPasswordLabel = document.querySelector('#auth-password-label');
const authSubmit = document.querySelector('#auth-submit');
const authStatus = document.querySelector('#auth-status');
const adminLoginButton = document.querySelector('#admin-login-button');
const authCloseButton = document.querySelector('#auth-close');
let adminToken = '';
let teachersSaveTimeout;
const teachersStorageKey = '9vclass-teachers';

function restoreTeachers() {
  try {
    const saved = JSON.parse(localStorage.getItem(teachersStorageKey) || '[]');
    document.querySelectorAll('[data-teacher-field]').forEach((input, index) => { input.value = saved[index] || ''; });
  } catch {}
}

function saveTeachers() {
  const teachers = Array.from(document.querySelectorAll('[data-teacher-field]'), input => input.value);
  localStorage.setItem(teachersStorageKey, JSON.stringify(teachers));
  clearTimeout(teachersSaveTimeout);
  teachersSaveTimeout = setTimeout(() => fetch('/api/teachers', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ teachers }) }).catch(() => {}), 500);
}

async function loadTeachers() {
  try {
    const response = await fetch('/api/teachers');
    if (!response.ok) return;
    const teachers = (await response.json()).teachers;
    if (!Array.isArray(teachers) || !teachers.some(Boolean)) return;
    document.querySelectorAll('[data-teacher-field]').forEach((input, index) => { input.value = teachers[index] || ''; });
    localStorage.setItem(teachersStorageKey, JSON.stringify(teachers));
  } catch {}
}

function setScheduleEditing(enabled) {
  document.querySelectorAll('.schedule-entry input').forEach(input => {
    input.readOnly = !enabled;
    input.setAttribute('aria-readonly', String(!enabled));
  });
}

function setTeachersEditing(enabled) {
  document.querySelectorAll('[data-teacher-field]').forEach(input => { input.readOnly = !enabled; });
}

setScheduleEditing(false);
setTeachersEditing(false);
restoreTeachers();
loadTeachers();
document.body.dataset.accessMode = 'visitor';

document.querySelectorAll('[data-teacher-field]').forEach(input => input.addEventListener('input', () => {
  if (document.body.dataset.accessMode === 'admin') saveTeachers();
}));

adminLoginButton.addEventListener('click', () => {
  authOverlay.hidden = false;
  authStatus.textContent = '';
});

authCloseButton.addEventListener('click', () => {
  authOverlay.hidden = true;
  authStatus.textContent = '';
});

document.querySelector('#auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  const enteredLogin = document.querySelector('#auth-login').value.trim();
  const enteredPassword = document.querySelector('#auth-password').value;
  authStatus.textContent = 'Проверяем…';
  try {
    const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: enteredLogin, password: enteredPassword }) });
    if (!response.ok) throw new Error('login failed');
    adminToken = (await response.json()).token;
  } catch {
    authStatus.textContent = 'Неверный логин или пароль.';
    return;
  }
  authOverlay.hidden = true;
  document.body.dataset.accessMode = 'admin';
  setScheduleEditing(true);
  setTeachersEditing(true);
});
