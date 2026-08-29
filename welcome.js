const welcomePopup = document.querySelector('#welcomePopup');
const welcomeDatetime = document.querySelector('#welcomeDatetime');

function updateWelcomeDatetime() {
  welcomeDatetime.textContent = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(new Date(Date.now() + 60 * 60 * 1000));
}

updateWelcomeDatetime();
setInterval(updateWelcomeDatetime, 1000);

document.querySelector('#closeWelcome').addEventListener('click', () => {
  welcomePopup.classList.add('is-closing');
  setTimeout(() => { welcomePopup.hidden = true; }, 250);
});
