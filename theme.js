(() => {
  const THEME_KEY = 'duo-equilibrium-theme';
  const body = document.body;
  const dashboard = body?.classList.contains('dashboard-dark') || Boolean(document.querySelector('.dashboard-shell'));

  const readTheme = () => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (_) {
      // Storage can be unavailable in private browsing; the page still works.
    }
    return dashboard ? 'dark' : 'light';
  };

  const saveTheme = (theme) => {
    try { window.localStorage.setItem(THEME_KEY, theme); } catch (_) { /* no-op */ }
  };

  const applyTheme = (theme) => {
    const dark = theme === 'dark';
    document.documentElement.dataset.theme = theme;
    if (dashboard) {
      body.classList.toggle('dashboard-dark', dark);
      body.classList.toggle('light-theme', !dark);
      body.classList.remove('dark-theme');
    } else {
      body.classList.toggle('dark-theme', dark);
      body.classList.toggle('light-theme', !dark);
    }

    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const nextLabel = dark ? 'Ativar modo claro' : 'Ativar modo escuro';
      button.setAttribute('aria-label', nextLabel);
      button.setAttribute('title', nextLabel);
      button.setAttribute('aria-pressed', String(dark));
    });
  };

  applyTheme(readTheme());

  const bind = () => {
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        saveTheme(nextTheme);
        applyTheme(nextTheme);
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
})();
