/* =========================================================
   전시 도록 PDF 저장
   - 표지(메인 페이지 내용) + 제1~3전시실의 모든 유물 카드를 순서대로 모아
     한 장짜리 인쇄 문서를 만든 뒤 브라우저 인쇄 → ‘PDF로 저장’으로 넘긴다
   - 저장창에 뜨는 기본 파일명은 document.title 을 따라가므로
     인쇄 직전에 제목을 “학번_이름”으로 바꿔 둔다 (아이패드 사파리 포함)
   ========================================================= */
(function () {
  'use strict';

  var buttons = document.querySelectorAll('[data-export-pdf]');
  if (!buttons.length) return;

  var root = document.documentElement;
  var status = document.querySelector('[data-export-status]');

  // 자료 종류에 따라 도록에 적히는 이름도 달라진다 (exhibit.js의 KINDS와 짝)
  var KINDS = {
    artifact: {
      label: '유물 · 문화재',
      alt: '유물 사진',
      desc: '유물 설명',
      event: '관련 역사적 사건'
    },
    event: {
      label: '역사적 사건 사진',
      alt: '역사적 사건 사진',
      desc: '사진 속 장면 설명',
      event: '사건의 배경과 의미'
    }
  };

  function kindOf(v) { return (v === 'event') ? 'event' : 'artifact'; }

  var ROOMS = [
    { id: 'room1', no: '01', years: '1910 — 1945', title: '빼앗긴 들에도 봄은 오는가' },
    { id: 'room2', no: '02', years: '1945 — 1960', title: '광복, 그리고 다시 갈라진 땅' },
    { id: 'room3', no: '03', years: '1960 — 현재', title: '산업화와 민주화, 오늘의 우리' }
  ];

  /* ---------- 도구 ---------- */
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;   // 항상 텍스트로만 넣는다
    return n;
  }

  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function visitor() {
    var v = readJSON('museum-visitor');
    return (v && v.sid && v.name) ? v : null;
  }

  // 파일 이름에 쓸 수 없는 글자를 걷어낸다
  function fileBase(v) {
    var name = v.sid + '_' + v.name;
    return name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '') || '전시도록';
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  }

  // 사진도 글도 없는 카드는 도록에서 제외한다
  function filled(items) {
    return (items || []).filter(function (it) {
      return it && (it.photo || (it.desc || '').trim() || (it.event || '').trim());
    });
  }

  // msg: 안내 문구 자리에 쓸 문장 / short: 버튼 글자로 잠깐 바꿔 넣을 짧은 말
  function notify(msg, isError, short) {
    if (status) {
      status.textContent = msg;
      status.classList.toggle('is-error', !!isError);
      return;
    }
    // 안내 문구를 놓을 자리가 없는 페이지에서는 버튼 글자를 잠깐 바꾼다
    Array.prototype.forEach.call(buttons, function (b) {
      if (b.dataset.label == null) b.dataset.label = b.textContent.trim();
      b.textContent = short || msg;
      setTimeout(function () { b.textContent = b.dataset.label; }, 2600);
    });
  }

  /* ---------- 표지 ---------- */
  function buildCover(v, rooms, total) {
    var sec = el('section', 'pr-cover');

    sec.appendChild(el('p', 'pr-eyebrow', 'EXHIBITION CATALOGUE'));
    sec.appendChild(el('h1', 'pr-cover-title', '근현대 전시전 기획하기'));
    sec.appendChild(el('p', 'pr-cover-sub', '2026학년도 2학기 · 한국사2 수행평가'));
    sec.appendChild(el('div', 'pr-rule'));
    sec.appendChild(el('p', 'pr-cover-desc',
      '1910년 국권 침탈에서 오늘에 이르기까지, 한 세기의 한국 근현대사를 ' +
      '세 개의 전시실에 나누어 담았습니다. 남겨진 유물과 문화재는 그 시대를 살아낸 ' +
      '사람들이 우리에게 건네는 가장 구체적인 증언입니다.'));

    var meta = el('dl', 'pr-meta');
    [
      ['기획자', v.sid + ' · ' + v.name],
      ['과목', '한국사2 · 2학기'],
      ['작성일', today()],
      ['전시 구성', '3개 전시실 · 자료 ' + total + '점'],
      ['전시 기간', '1910 — 현재']
    ].forEach(function (row) {
      var wrap = document.createElement('div');
      wrap.appendChild(el('dt', null, row[0]));
      wrap.appendChild(el('dd', null, row[1]));
      meta.appendChild(wrap);
    });
    sec.appendChild(meta);

    var toc = el('ol', 'pr-toc');
    rooms.forEach(function (r) {
      var li = el('li', 'pr-room-' + r.no);   // 전시실 색을 목차에도 물린다
      li.appendChild(el('span', 'pr-toc-no', r.no));
      li.appendChild(el('span', 'pr-toc-title', r.title));
      li.appendChild(el('span', 'pr-toc-side', r.years + ' · ' + r.items.length + '점'));
      toc.appendChild(li);
    });
    sec.appendChild(toc);

    return sec;
  }

  /* ---------- 유물 카드 ---------- */
  function buildCard(item, index) {
    var K = KINDS[kindOf(item.kind)];
    var card = el('article', 'pr-card');

    var fig = el('figure', 'pr-figure');
    if (item.photo) {
      var img = document.createElement('img');
      img.src = item.photo;
      img.alt = K.alt + ' ' + index;
      fig.appendChild(img);
    } else {
      fig.className = 'pr-figure is-empty';
      fig.textContent = '사진 없음';
    }
    card.appendChild(fig);

    var body = el('div', 'pr-body');

    // 번호와 함께 어떤 종류의 자료인지 밝힌다
    var head = el('p', 'pr-index');
    head.appendChild(el('span', null, 'EXHIBIT ' + ('0' + index).slice(-2)));
    head.appendChild(el('span', 'pr-kind', K.label));
    body.appendChild(head);

    [[K.desc, item.desc], [K.event, item.event]].forEach(function (f) {
      var field = el('div', 'pr-field');
      field.appendChild(el('h3', null, f[0]));
      var value = (f[1] || '').trim();
      field.appendChild(el('p', value ? null : 'is-blank', value || '(작성되지 않음)'));
      body.appendChild(field);
    });

    card.appendChild(body);
    return card;
  }

  /* ---------- 인쇄 문서 만들기 ---------- */
  function buildSheet(v, rooms, total) {
    var sheet = el('div', 'print-sheet');
    sheet.appendChild(buildCover(v, rooms, total));

    rooms.forEach(function (r) {
      var sec = el('section', 'pr-room pr-room-' + r.no);

      var head = el('header', 'pr-room-head');
      head.appendChild(el('p', 'pr-eyebrow', 'ROOM ' + r.no + ' · ' + r.years));
      head.appendChild(el('h2', 'pr-room-title', r.title));
      sec.appendChild(head);

      if (!r.items.length) {
        sec.appendChild(el('p', 'pr-empty', '이 전시실에는 아직 등록된 자료가 없습니다.'));
      } else {
        r.items.forEach(function (item, i) {
          sec.appendChild(buildCard(item, i + 1));
        });
      }

      sec.appendChild(el('p', 'pr-foot', '근현대 전시전 기획하기 · ' + v.sid + ' ' + v.name));
      sheet.appendChild(sec);
    });

    return sheet;
  }

  /* ---------- 저장된 세 전시실을 모두 모은다 ---------- */
  function collectRooms() {
    return ROOMS.map(function (r) {
      return {
        no: r.no, years: r.years, title: r.title,
        items: filled(readJSON('museum-exhibit:' + r.id))
      };
    });
  }

  function countAll(rooms) {
    return rooms.reduce(function (sum, r) { return sum + r.items.length; }, 0);
  }

  /* =======================================================
     저장 파일 이름을 학번_이름으로 붙잡아 두기

     저장창에 뜨는 기본 파일명은 그 순간의 문서 제목을 따라간다.
     그런데 아이패드 사파리는 인쇄 창이 뜬 뒤 ‘공유 → 파일에 저장’을
     누를 때 이름을 정하는데, 그 사이에 afterprint 가 먼저 날아와
     제목을 되돌려 버리면 페이지 제목으로 저장돼 버린다.
     그래서 인쇄가 끝나도 제목을 바로 되돌리지 않고,
     학생이 화면을 다시 만질 때까지 학번_이름을 유지한다.
     ======================================================= */
  var titleHold = null;

  function releaseTitle(e) {
    if (!titleHold) return;
    // 인쇄 창이 뜨기 전의 스크롤·오터치로 제목이 먼저 돌아가지 않게 잠깐 기다린다
    if (e && Date.now() < titleHold.keepUntil) return;

    clearTimeout(titleHold.timer);
    document.removeEventListener('pointerdown', releaseTitle, true);
    document.removeEventListener('keydown', releaseTitle, true);
    document.title = titleHold.original;
    titleHold = null;
  }

  function holdTitle(name) {
    if (!titleHold) titleHold = { original: document.title };
    else clearTimeout(titleHold.timer);

    document.title = name;
    titleHold.keepUntil = Date.now() + 3000;

    // 저장을 마치고 화면을 다시 만지면 원래 제목으로 돌아온다
    document.addEventListener('pointerdown', releaseTitle, true);
    document.addEventListener('keydown', releaseTitle, true);
    titleHold.timer = setTimeout(releaseTitle, 300000);   // 5분 뒤 자동 복구
  }

  /* ---------- 인쇄 준비 (버튼 · 브라우저 인쇄 공통) ---------- */
  function preparePrint(v, rooms, total, auto) {
    var old = document.querySelector('.print-sheet');
    if (old) old.remove();

    var sheet = buildSheet(v, rooms, total);
    if (auto) sheet.setAttribute('data-auto-sheet', '');
    document.body.appendChild(sheet);

    holdTitle(fileBase(v));        // 저장창의 기본 파일명 = 학번_이름
    root.classList.add('is-printing');
    return sheet;
  }

  /* ---------- 인쇄 실행 ---------- */
  function run() {
    var v = visitor();
    if (!v) {
      notify('학번과 이름을 먼저 입력해 주세요.', true, '학번·이름 필요');
      return;
    }

    // 지금 어느 전시실을 보고 있든, 저장된 세 전시실을 전부 담는다
    var rooms = collectRooms();

    var total = countAll(rooms);
    if (!total) {
      notify('아직 등록된 자료가 없습니다. 전시실에서 유물이나 사건 사진을 등록한 뒤 저장해 주세요.',
             true, '등록된 자료 없음');
      return;
    }

    var sheet = preparePrint(v, rooms, total, false);

    // 인쇄가 끝나면 화면만 되돌린다 (제목은 저장이 끝날 때까지 그대로 둔다)
    var restored = false;
    function restoreLayout() {
      if (restored) return;
      restored = true;
      window.removeEventListener('afterprint', restoreLayout);
      root.classList.remove('is-printing');
      if (sheet.parentNode) sheet.remove();
    }
    window.addEventListener('afterprint', restoreLayout);
    // afterprint 를 보내지 않는 브라우저를 위한 안전장치
    setTimeout(restoreLayout, 120000);

    notify('자료 ' + total + '점을 담았습니다. 인쇄 창에서 ‘PDF로 저장’을 고르세요. ' +
           '파일명은 ' + fileBase(v) + '.pdf 로 채워집니다.',
           false, '인쇄 창을 엽니다…');

    // 사진·글꼴이 자리를 잡고, 바뀐 제목이 반영될 시간을 준 뒤 인쇄 창을 연다
    setTimeout(function () { window.print(); }, 450);
  }

  Array.prototype.forEach.call(buttons, function (btn) {
    btn.addEventListener('click', run);
  });

  /* ---------- 안전장치 ----------
     버튼 대신 브라우저 인쇄(Ctrl+P · 공유▸프린트)를 눌렀을 때도
     보고 있던 전시실 하나만 나오지 않도록 도록 문서를 만들고,
     파일 이름도 똑같이 학번_이름으로 맞춘다. */
  window.addEventListener('beforeprint', function () {
    var v = visitor();
    if (!v) return;                                       // 학번·이름이 없으면 그대로 둔다

    if (document.querySelector('.print-sheet')) {          // 버튼으로 이미 만든 경우
      holdTitle(fileBase(v));                              // 제목만 다시 확인해 둔다
      return;
    }

    var rooms = collectRooms();
    var total = countAll(rooms);
    if (!total) return;

    preparePrint(v, rooms, total, true);
  });

  window.addEventListener('afterprint', function () {
    var auto = document.querySelector('.print-sheet[data-auto-sheet]');
    if (!auto) return;
    auto.remove();
    root.classList.remove('is-printing');
  });
})();
