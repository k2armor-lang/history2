/* =========================================================
   화면 전환 · 공통 네비게이션
   - 로비와 세 전시실을 한 파일 안에서 화면 단위로 갈아 끼운다
     (전시실은 눌러서 들어가고, 주소의 #room1 로도 바로 열 수 있다)
   - 로비의 전시실 카드에는 작성 상태를 표시한다
   ========================================================= */

/* ---------- 1. 접이식 네비게이션 토글 (태블릿 세로 900px 이하) ---------- */
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.site-nav');
  if (!toggle || !nav) return;

  // CSS의 13-2 구간과 같은 폭을 쓴다
  var NAV_BREAKPOINT = 900;

  function setOpen(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  }

  toggle.addEventListener('click', function () {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  // 메뉴 항목 선택 시 닫기
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false);
  });

  // 메뉴 밖을 누르면 닫기 (태블릿에서 실수로 열어 두기 쉬운 탓)
  document.addEventListener('pointerdown', function (e) {
    if (toggle.getAttribute('aria-expanded') !== 'true') return;
    if (nav.contains(e.target) || toggle.contains(e.target)) return;
    setOpen(false);
  });

  // ESC로 닫기
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setOpen(false);
  });

  // 가로 메뉴가 다시 보이는 폭(태블릿 가로 회전 포함)이 되면 상태 초기화
  window.addEventListener('resize', function () {
    if (window.innerWidth > NAV_BREAKPOINT) setOpen(false);
  });
  window.addEventListener('orientationchange', function () {
    setOpen(false);
  });
})();

/* ---------- 2. 화면(로비 · 전시실) 전환 ---------- */
(function () {
  'use strict';

  var views = document.querySelectorAll('[data-view]');
  if (!views.length) return;

  var DEFAULT_VIEW = 'lobby';
  var current = null;

  function viewByName(name) {
    for (var i = 0; i < views.length; i++) {
      if (views[i].getAttribute('data-view') === name) return views[i];
    }
    return null;
  }

  // 주소의 #아이디가 어느 화면에 속하는지 찾는다 (#export → 로비)
  function locate(id) {
    var el = id ? document.getElementById(id) : null;
    if (!el) return { view: DEFAULT_VIEW, target: null };

    var holder = el.closest('[data-view]');
    if (!holder) return { view: DEFAULT_VIEW, target: el };

    return {
      view: holder.getAttribute('data-view'),
      target: (el === holder) ? null : el   // 화면 자체를 가리키면 맨 위로
    };
  }

  // 상단·바닥글 메뉴에 지금 보고 있는 화면을 표시
  // (화면 자체를 가리키는 링크만 표시한다. #export처럼 화면 안의 한 구획을
  //  가리키는 링크까지 켜지면 탭이 두 개 켜진 것처럼 보인다)
  function markMenus(name) {
    var links = document.querySelectorAll('.nav-list a[href^="#"], .footer-nav a[href^="#"]');
    Array.prototype.forEach.call(links, function (a) {
      var spot = locate(a.getAttribute('href').slice(1));
      if (spot.view === name && !spot.target) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  function show(name, target) {
    var next = viewByName(name) || viewByName(DEFAULT_VIEW);
    if (!next) return;

    var changed = (next !== current);

    Array.prototype.forEach.call(views, function (v) {
      v.classList.toggle('is-active', v === next);
    });
    current = next;
    markMenus(next.getAttribute('data-view'));

    if (target) {
      target.scrollIntoView();
    } else if (changed) {
      window.scrollTo(0, 0);
    }

    if (changed) {
      // 숨어 있던 동안에는 높이를 잴 수 없다 — 각 화면이 스스로 다시 맞추도록 알린다
      document.dispatchEvent(new CustomEvent('view:shown', {
        detail: { view: next.getAttribute('data-view'), el: next }
      }));

      // 화면이 바뀐 것을 스크린 리더에도 알린다
      var heading = next.querySelector('h1, h2');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        try { heading.focus({ preventScroll: true }); } catch (err) { /* 무시 */ }
      }
    }
  }

  function route() {
    var spot = locate(location.hash.slice(1));
    show(spot.view, spot.target);
  }

  window.addEventListener('hashchange', route);

  // 같은 주소를 다시 눌렀을 때도 그 화면으로 가도록 (hashchange가 일어나지 않는 경우)
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (!id || ('#' + id) !== location.hash) return;
    e.preventDefault();
    route();
  });

  route();
})();

/* ---------- 3. 로비의 전시실 작성 상태 ---------- */
(function () {
  'use strict';

  var badges = document.querySelectorAll('[data-room-status]');
  var summary = document.querySelector('[data-export-summary]');
  if (!badges.length && !summary) return;

  var ROOMS = ['room1', 'room2', 'room3'];

  function read(room) {
    try {
      var raw = localStorage.getItem('museum-exhibit:' + room);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  }

  // 사진과 두 칸을 모두 채웠으면 '작성 완료'
  function stateOf(room) {
    var items = read(room) || [];
    var filled = items.filter(function (it) {
      return it && (it.photo || (it.desc || '').trim() || (it.event || '').trim());
    });
    if (!filled.length) return 'empty';

    var done = filled.some(function (it) {
      return it.photo && (it.desc || '').trim() && (it.event || '').trim();
    });
    return done ? 'done' : 'partial';
  }

  var LABEL = {
    empty:   '아직 비어 있음',
    partial: '작성 중',
    done:    '작성 완료 ✓'
  };

  function paint() {
    var done = 0;

    ROOMS.forEach(function (room) {
      var state = stateOf(room);
      if (state === 'done') done++;

      Array.prototype.forEach.call(
        document.querySelectorAll('[data-room-status="' + room + '"]'),
        function (el) {
          el.textContent = LABEL[state];
          el.className = 'room-status is-' + state;
        }
      );
    });

    if (summary) {
      summary.textContent = (done === ROOMS.length)
        ? '세 전시실이 모두 채워졌습니다. 아래 버튼으로 도록을 저장해 제출하세요.'
        : '현재 ' + ROOMS.length + '개 전시실 가운데 ' + done + '곳이 완성되었습니다. ' +
          '지금 저장해도 작성한 내용은 모두 한 파일에 담깁니다.';
      summary.classList.toggle('is-done', done === ROOMS.length);
    }
  }

  // 로비로 돌아올 때마다 다시 계산한다
  document.addEventListener('view:shown', function (e) {
    if (e.detail && e.detail.view === 'lobby') paint();
  });
  // 전시실에서 내용을 고치면 바로 반영
  document.addEventListener('exhibit:saved', paint);

  paint();
})();
