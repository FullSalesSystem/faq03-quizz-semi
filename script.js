(function () {
  const TOTAL = 5;
  let current = 1;

  /* ── dataLayer (GTM-MK7SRXJ9) ──────────────────────────────
     Eventos p/ mapear no GTM: pb_quiz_view, pb_quiz_step, pb_quiz_complete
     Params comuns em todo push: variante ('qualificado'|'semi'), funil ('playbook') */
  var PB_VARIANTE = 'semi';
  function dl(evt, params) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: evt, variante: PB_VARIANTE, funil: 'playbook' }, params || {}));
  }
  var PB_QUESTIONS = { 1: 'como-vende', 2: 'obstaculos', 3: 'qualificacao-perguntas', 4: 'colaboradores', 5: 'disposicao' };
  function pbAnswerOf(step) {
    if (step === 2) {
      return Array.from(document.querySelectorAll('input[name="q2"]:checked')).map(function (cb) { return cb.value; }).join(',');
    }
    var el = document.querySelector('input[name="q' + step + '"]:checked');
    return el ? el.value : '';
  }
  function newSubmissionId() {
    if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return 'sid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  }

  /* ── URL params (vindos do faq03-playbook) ── */
  function getQueryParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name) || '';
    } catch (e) {
      return '';
    }
  }

  const progressBar = document.getElementById('progress-bar');
  const stepLabel   = document.getElementById('step-label');
  const stepNum     = document.getElementById('step-num');
  const btnBack     = document.getElementById('btn-back');
  const btnConfirm  = document.getElementById('btn-confirm');
  const btnSubmit   = document.getElementById('btn-submit');

  /* ── Show step ── */
  function showStep(num, back) {
    for (let i = 1; i <= TOTAL; i++) {
      const wrapper = document.getElementById('wrapper-' + i) || (i === 1 ? document.querySelector('.steps-wrapper') : null);
      const step    = document.getElementById('step-' + i);
      if (!wrapper || !step) continue;
      if (i === num) {
        wrapper.style.display = '';
        step.classList.add('active');
        step.classList.toggle('anim-back', !!back);
        void step.offsetWidth; /* re-trigger animation */
      } else {
        wrapper.style.display = 'none';
        step.classList.remove('active');
      }
    }
  }

  /* ── Update UI ── */
  function updateUI() {
    stepLabel.textContent   = 'Pergunta ' + current + ' de ' + TOTAL;
    stepNum.textContent     = current;
    progressBar.style.width = ((current / TOTAL) * 100) + '%';
    btnBack.classList.toggle('btn--hidden', current === 1);
    btnConfirm.classList.toggle('btn--hidden', current !== 2);
    btnSubmit.classList.add('btn--hidden');
  }

  /* ── Advance / submit ── */
  function advance() {
    if (current < TOTAL) {
      current++;
      dl('pb_quiz_step', {
        step: current,
        question: PB_QUESTIONS[current],
        answer_prev: pbAnswerOf(current - 1)
      });
      showStep(current, false);
      updateUI();
    } else {
      submitQuiz();
    }
  }

  var REDIRECT_URL = 'https://playbook-calendly-semi.fullsalessystem.com/';
  /* Endpoint do quiz QUALIFICADO (mesmo GHL). Este projeto não tem backend;
     o /api/quiz de lá tem CORS liberado para playbook-quizz-semi.fullsalessystem.com. */
  var API_URL = 'https://playbook-quizz.fullsalessystem.com/api/quiz';

  /* ── Submit ── */
  function submitQuiz() {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Enviado ✓';

    var q1 = document.querySelector('input[name="q1"]:checked');
    var q2 = Array.from(document.querySelectorAll('input[name="q2"]:checked')).map(function (cb) { return cb.value; });
    var q3 = document.querySelector('input[name="q3"]:checked');
    var q4 = document.querySelector('input[name="q4"]:checked');
    var q5 = document.querySelector('input[name="q5"]:checked');
    var submissionId = newSubmissionId();

    /* pb_quiz_complete ANTES do fetch/redirect (delay de 300ms p/ tag GTM disparar) */
    dl('pb_quiz_complete', {
      q1: q1 ? q1.value : '',
      q2: q2.join(','),
      q3: q3 ? q3.value : '',
      q4: q4 ? q4.value : '',
      q5: q5 ? q5.value : '',
      resultado: q2.join(','),
      submission_id: submissionId
    });

    var payload = {
      submission_id: submissionId,
      submitted_at: new Date().toISOString(),
      page: window.location.href,
      email: getQueryParam('email'),
      whatsapp: getQueryParam('whatsapp'),
      nome: getQueryParam('name'),
      classification: getQueryParam('classification'),
      q1: q1 ? q1.value : '',
      q2: q2,
      q3: q3 ? q3.value : '',
      q4: q4 ? q4.value : '',
      q5: q5 ? q5.value : ''
    };

    /* Fire-and-forget cross-origin com keepalive (sobrevive ao redirect).
       Content-Type text/plain = "simple request" (sem preflight OPTIONS);
       o serverless do qualificado faz JSON.parse do body string. */
    try {
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(payload),
        keepalive: true
      }).then(function (res) {
        if (!res.ok) console.warn('[quiz] api returned', res.status);
      }).catch(function (err) {
        console.warn('[quiz] api error', err);
      });
    } catch (e) {
      console.warn('[quiz] fetch unavailable', e);
    }

    setTimeout(function () {
      window.location.href = REDIRECT_URL;
    }, 300);
  }

  btnSubmit.addEventListener('click', submitQuiz);

  /* ── Radio: auto-advance after short delay ── */
  document.querySelectorAll('input[type="radio"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      document.querySelectorAll('input[name="' + radio.name + '"]').forEach(function (r) {
        r.closest('.option, .scale-option').classList.remove('selected');
      });
      radio.closest('.option, .scale-option').classList.add('selected');
      setTimeout(function () {
        if (current === TOTAL) {
          btnSubmit.classList.remove('btn--hidden');
        } else {
          advance();
        }
      }, 380);
    });
  });

  /* ── Checkboxes: highlight + "Todos acima" mutual exclusion ── */
  document.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      if (cb.value === 'todos' && cb.checked) {
        document.querySelectorAll('input[name="q2"]').forEach(function (other) {
          if (other.value !== 'todos') {
            other.checked = false;
            other.closest('.option').classList.remove('selected');
          }
        });
      } else if (cb.value !== 'todos' && cb.checked) {
        const todos = document.getElementById('todos-acima');
        todos.checked = false;
        todos.closest('.option').classList.remove('selected');
      }
      cb.closest('.option').classList.toggle('selected', cb.checked);
    });
  });

  /* ── Confirm button (step 2) ── */
  btnConfirm.addEventListener('click', function () {
    if (!document.querySelector('input[name="q2"]:checked')) {
      const card = document.getElementById('quiz-card');
      card.style.animation = 'none';
      void card.offsetWidth;
      card.style.animation = 'shake 0.4s ease';
      return;
    }
    advance();
  });

  /* ── Back ── */
  btnBack.addEventListener('click', function () {
    if (current > 1) {
      current--;
      showStep(current, true);
      updateUI();
    }
  });

  /* ── Shake keyframe ── */
  const style = document.createElement('style');
  style.textContent = '@keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }';
  document.head.appendChild(style);

  /* init */
  updateUI();
  dl('pb_quiz_view', { step: 1, question: PB_QUESTIONS[1] });
})();
