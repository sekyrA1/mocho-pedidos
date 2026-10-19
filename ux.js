(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const animate = element => {
    if (!element || reduced.matches) return;
    element.getAnimations().forEach(animation => animation.cancel());
    element.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
  };
  reduced.addEventListener('change', () => {
    if (reduced.matches) document.getAnimations().forEach(animation => animation.cancel());
  });
  const main = document.querySelector('main');
  if (main) {
    if (!main.id) main.id = 'conteudo-principal';
    main.tabIndex = -1;
    const skip = document.createElement('a');
    skip.className = 'ux-skip'; skip.href = `#${main.id}`; skip.textContent = 'Pular para o conteúdo';
    document.body.prepend(skip);
  }
  animate(document.querySelector('.auth-shell'));
  // Keep every existing input and its listeners intact, including invitation forms.
  const enhancePasswords = () => document.querySelectorAll('input[type="password"]:not([data-ux-password])').forEach(input => {
    input.dataset.uxPassword = 'true';
    if (!input.hasAttribute('aria-label') && input.labels?.length) input.setAttribute('aria-label', input.labels[0].textContent.trim());
    const wrap = document.createElement('span'); wrap.className = 'ux-password-wrap';
    input.before(wrap); wrap.append(input);
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'ux-password-toggle';
    toggle.textContent = 'Mostrar'; toggle.setAttribute('aria-label', 'Mostrar senha'); toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-controls', input.id);
    toggle.addEventListener('click', () => {
      const show = input.type === 'password'; input.type = show ? 'text' : 'password';
      toggle.textContent = show ? 'Ocultar' : 'Mostrar'; toggle.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha'); toggle.setAttribute('aria-pressed', String(show));
    });
    wrap.append(toggle);
  });
  if (document.body.dataset.ui === 'auth') {
    enhancePasswords(); new MutationObserver(enhancePasswords).observe(document.querySelector('.auth-card'), { childList: true, subtree: true });
  }
  document.querySelectorAll('[data-dashboard-page]').forEach(page => {
    new MutationObserver(() => { if (!page.hidden) animate(page); }).observe(page, { attributes: true, attributeFilter: ['hidden'] });
  });
  const trigger = document.querySelector('.ux-command-trigger');
  if (!trigger) return;
  const dialog = document.createElement('dialog'); dialog.className = 'ux-palette'; dialog.setAttribute('aria-labelledby', 'ux-palette-title');
  dialog.innerHTML = '<h2 id="ux-palette-title">Aonde vamos?</h2><p>Encontre uma seção do painel.</p><input type="search" aria-label="Buscar seção" placeholder="Digite uma seção…" autocomplete="off"><div class="ux-palette-results"></div><button type="button" class="ux-palette-close">Fechar · Esc</button>';
  document.body.append(dialog);
  const search = dialog.querySelector('input'); const results = dialog.querySelector('.ux-palette-results');
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const render = () => {
    results.replaceChildren();
    document.querySelectorAll('.dashboard-menu [data-dashboard-nav]').forEach(source => {
      if (source.hidden || source.disabled || getComputedStyle(source).display === 'none' || !normalize(source.textContent).includes(normalize(search.value))) return;
      const button = document.createElement('button'); button.type = 'button'; button.textContent = source.textContent.trim();
      button.addEventListener('click', () => { dialog.close(); source.click(); }); results.append(button);
    });
    if (!results.children.length) { const empty = document.createElement('p'); empty.textContent = 'Nenhuma seção encontrada.'; empty.setAttribute('role', 'status'); results.append(empty); }
  };
  const open = () => { if (document.querySelector('dialog[open]')) return; search.value = ''; render(); dialog.showModal(); search.focus(); animate(dialog); };
  trigger.addEventListener('click', open); search.addEventListener('input', render);
  dialog.querySelector('.ux-palette-close').addEventListener('click', () => dialog.close());
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); open(); }
  });
  dialog.addEventListener('keydown', event => {
    event.stopPropagation();
    const buttons = [...results.querySelectorAll('button')]; const index = buttons.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); if (buttons.length) buttons[(index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1) + buttons.length) % buttons.length].focus();
    } else if (event.key === 'Enter' && document.activeElement === search) { event.preventDefault(); buttons[0]?.click(); }
  });
})();
