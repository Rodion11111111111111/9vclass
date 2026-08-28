const students = [
  ['Абенова Аруна', 'Ученица'], ['Абылкасым Нурасыл', 'Ученик'], ['Айтимов Алдияр', 'Ученик'], ['Айтимов Алияр', 'Ученик'], ['Аширов Хангельды', 'Ученик'], ['Барков Марк', 'Ученик'], ['Демкина Мария', 'Ученица'], ['Ещанова Аружан', 'Ученица'], ['Зеленкин Денис', 'Ученик'], ['Какенова Тамирис', 'Ученица'], ['Ковалдин Дмитрий', 'Ученик'], ['Комратова Яна', 'Ученица'], ['Обозный Владислав', 'Ученик'], ['Оганесян Никита', 'Ученик'], ['Палинка Александр', 'Ученик'], ['Пристенная Екатерина', 'Ученица'], ['Сидиков Марсель', 'Ученик'], ['Смирнов Артём', 'Староста класса'], ['Сушко Надежда', 'Ученица'], ['Тагабергенова Томирис', 'Ученица'], ['Чернышов Родион', 'Заместитель старосты']
];
const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница'];
document.querySelector('#student-grid').innerHTML = students.map(([name, role]) => {
  const initials = name.split(' ').map(part => part[0]).join('').slice(0, 2);
  return `<article class="student"><span class="initials">${initials}</span><div><b>${name}</b><small>${role}</small></div></article>`;
}).join('');
document.querySelector('#schedule-grid').innerHTML = days.map(day => `<article class="day-card"><h3>${day}</h3><p>Предметы будут добавлены после переноса таблицы расписания.</p></article>`).join('');

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
