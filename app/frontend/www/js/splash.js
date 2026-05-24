document.addEventListener('DOMContentLoaded', () => {
  if (isLoggedIn()) {
    window.location.replace('app.html');
  }
});
