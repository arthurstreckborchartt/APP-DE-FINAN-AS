// Aplica o tema escuro antes da primeira pintura. Fica em arquivo próprio (e não
// inline no index.html) para a Content-Security-Policy poder usar script-src 'self'.
try {
  var p = localStorage.getItem('theme') || 'system';
  var dark = p === 'dark' || (p === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
