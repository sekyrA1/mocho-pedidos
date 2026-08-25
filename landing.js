document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.nav-tabs');
  const indicator = document.querySelector('.nav-indicator');
  const links = [...document.querySelectorAll('.nav-tab[href^="#"]')];
  const sections = links.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);

  function ativar(link) {
    links.forEach(item => item.classList.toggle('active', item === link));
    indicator.style.width = `${link.offsetWidth}px`;
    indicator.style.transform = `translateX(${link.offsetLeft}px)`;
  }

  let lerpFrame;
  function rolarComLerp(section) {
    cancelAnimationFrame(lerpFrame);
    const inicio = window.scrollY;
    const destino = Math.max(0, section.getBoundingClientRect().top + window.scrollY - document.querySelector('.topbar').offsetHeight - 14);
    const comportamentoAnterior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    let posicao = inicio;
    const animar = () => {
      posicao += (destino - posicao) * .13;
      window.scrollTo(0, posicao);
      if (Math.abs(destino - posicao) > .8) lerpFrame = requestAnimationFrame(animar);
      else {
        window.scrollTo(0, destino);
        document.documentElement.style.scrollBehavior = comportamentoAnterior;
      }
    };
    animar();
  }
  links.forEach(link => link.addEventListener('click', event => {
    const section = document.querySelector(link.getAttribute('href'));
    if (!section) return;
    event.preventDefault();
    ativar(link);
    rolarComLerp(section);
  }));

  const observer = new IntersectionObserver(entries => {
    const visivel = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visivel) return;
    const link = links.find(item => item.getAttribute('href') === `#${visivel.target.id}`);
    if (link) ativar(link);
  }, { rootMargin: '-28% 0px -55% 0px', threshold: [0.05, 0.3, 0.6] });

  sections.forEach(section => observer.observe(section));
  window.addEventListener('resize', () => {
    const atual = nav.querySelector('.nav-tab.active');
    if (atual) ativar(atual);
  });
  ativar(nav.querySelector('.nav-tab.active'));

  const reveals = document.querySelectorAll('.reveal, .section-wrap');
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('is-visible');
    });
  }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
  reveals.forEach((element, index) => {
    if (element.classList.contains('reveal')) element.dataset.delay = String(index % 4);
    revealObserver.observe(element);
  });

  const progress = document.querySelector('.scroll-progress');
  const updateScrollMotion = () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const current = window.scrollY;
    progress.style.width = `${maxScroll > 0 ? (current / maxScroll) * 100 : 0}%`;
    document.documentElement.style.setProperty('--hero-shift', `${Math.min(current, 420)}px`);
  };
  window.addEventListener('scroll', updateScrollMotion, { passive: true });
  updateScrollMotion();

  const previousButton = document.querySelector('[data-carousel="prev"]');
  const nextButton = document.querySelector('[data-carousel="next"]');
  const carouselProgress = document.querySelector('.carousel-progress span');
  const carouselStatus = document.querySelector('.carousel-status');
  const carouselHandle = document.getElementById('carouselHandle');
  const carouselWrapper = document.querySelector('.carousel-swiper .swiper-wrapper');
  const cardsOriginais = [...carouselWrapper.children];
  const totalCards = cardsOriginais.length;
  const clonesAntes = cardsOriginais.slice(-3).map(slide => {
    const clone = slide.cloneNode(true);
    clone.dataset.carouselClone = 'before'; clone.setAttribute('aria-hidden', 'true');
    return clone;
  });
  const clonesDepois = cardsOriginais.slice(0, 3).map(slide => {
    const clone = slide.cloneNode(true);
    clone.dataset.carouselClone = 'after'; clone.setAttribute('aria-hidden', 'true');
    return clone;
  });
  carouselWrapper.prepend(...clonesAntes);
  carouselWrapper.append(...clonesDepois);

  const carousel = new Swiper('.carousel-swiper', {
    slidesPerView: 1,
    spaceBetween: 16,
    speed: 650,
    grabCursor: true,
    initialSlide: 3,
    centeredSlides: true,
    loop: false,
    navigation: false,
    a11y: { enabled: true },
    breakpoints: {
      640: { slidesPerView: 2, spaceBetween: 20 },
      980: { slidesPerView: 3, spaceBetween: 24 }
    }
  });

  const indiceInicial = 3;
  const indiceFinal = indiceInicial + totalCards - 1;
  let reposicionando = false;
  let timerAutoplay;
  function indiceReal() {
    return ((carousel.activeIndex - indiceInicial) % totalCards + totalCards) % totalCards;
  }
  function atualizarStatusCarrossel() {
    const atual = indiceReal() + 1;
    carouselProgress.style.width = `${(atual / totalCards) * 100}%`;
    carouselStatus.style.setProperty('--progress', `${6 + ((atual - 1) / Math.max(1, totalCards - 1)) * 88}%`);
    carouselHandle.value = atual;
  }
  function moverCarrossel(direcao = 1) {
    if (carousel.animating || reposicionando) return;
    carouselHost.classList.remove('is-sliding-forward', 'is-sliding-backward');
    carouselHost.classList.add('is-sliding', direcao > 0 ? 'is-sliding-forward' : 'is-sliding-backward');
    carousel.slideTo(carousel.activeIndex + direcao);
  }
  function iniciarAutoplay() {
    clearInterval(timerAutoplay);
    timerAutoplay = setInterval(() => moverCarrossel(1), 4200);
  }
  previousButton.addEventListener('click', () => { moverCarrossel(-1); iniciarAutoplay(); });
  nextButton.addEventListener('click', () => { moverCarrossel(1); iniciarAutoplay(); });
  carouselHandle.addEventListener('input', evento => {
    const desejado = Number(evento.target.value) - 1;
    const atual = indiceReal();
    if (desejado === atual || carousel.animating) return;
    carouselHost.classList.remove('is-sliding-forward', 'is-sliding-backward');
    carouselHost.classList.add('is-sliding', desejado > atual ? 'is-sliding-forward' : 'is-sliding-backward');
    carousel.slideTo(indiceInicial + desejado);
    iniciarAutoplay();
  });
  carousel.on('transitionEnd', () => {
    if (carousel.activeIndex === indiceFinal + 1) {
      reposicionando = true; carousel.slideTo(indiceInicial, 0, false); reposicionando = false;
    } else if (carousel.activeIndex === indiceInicial - 1) {
      reposicionando = true; carousel.slideTo(indiceFinal, 0, false); reposicionando = false;
    }
    carouselHost.classList.remove('is-sliding', 'is-sliding-forward', 'is-sliding-backward');
    atualizarStatusCarrossel();
  });
  carousel.on('slideChange resize', atualizarStatusCarrossel);
  const carouselHost = document.querySelector('.carousel-swiper');
  carouselHost.addEventListener('pointermove', evento => {
    const imagemAtiva = evento.target.closest('.swiper-slide-active .model-image-wrap');
    if (!imagemAtiva) return;
    const area = imagemAtiva.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((evento.clientX - area.left) / area.width) * 100));
    const y = Math.max(0, Math.min(100, ((evento.clientY - area.top) / area.height) * 100));
    const angulo = Math.round(Math.atan2(y - 50, x - 50) * (180 / Math.PI) + 90);
    imagemAtiva.style.setProperty('--spot-x', `${x}%`);
    imagemAtiva.style.setProperty('--spot-y', `${y}%`);
    imagemAtiva.style.setProperty('--border-angle', `${angulo}deg`);
  });
  carouselHost.addEventListener('pointerleave', () => {
    const imagemAtiva = carouselHost.querySelector('.swiper-slide-active .model-image-wrap');
    imagemAtiva?.style.setProperty('--spot-x', '50%');
    imagemAtiva?.style.setProperty('--spot-y', '50%');
    imagemAtiva?.style.setProperty('--border-angle', '135deg');
  });
  carouselHost.addEventListener('mouseenter', () => clearInterval(timerAutoplay));
  carouselHost.addEventListener('mouseleave', iniciarAutoplay);
  atualizarStatusCarrossel();
  iniciarAutoplay();

  const tiltCard = document.querySelector('[data-tilt-card]');
  if (tiltCard && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    tiltCard.addEventListener('pointermove', event => {
      const bounds = tiltCard.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - .5;
      const y = (event.clientY - bounds.top) / bounds.height - .5;
      tiltCard.style.setProperty('--tilt-x', `${(y * -3).toFixed(2)}deg`);
      tiltCard.style.setProperty('--tilt-y', `${(x * 4).toFixed(2)}deg`);
    });
    tiltCard.addEventListener('pointerleave', () => {
      tiltCard.style.setProperty('--tilt-x', '0deg');
      tiltCard.style.setProperty('--tilt-y', '0deg');
    });
  }

});
