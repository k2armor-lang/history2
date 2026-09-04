/* =========================================================
   전시 자료 카드 컴포넌트
   - 전시실마다 따로 동작한다
   - 놓을 수 있는 자료는 두 가지: 유물·문화재 / 역사적 사건 사진
     고른 종류에 따라 아래 서술칸이 묻는 내용이 바뀐다
   - 사진 첨부(클릭 / 드래그앤드롭) → 카드 안 미리보기
   - 서술칸 두 개 (길이 제한 없음, 자동 높이)
   - 입력 내용은 전시실별로 브라우저(localStorage)에 자동 저장
   ========================================================= */
(function () {
  'use strict';

  var tpl = document.getElementById('tpl-artifact-card');
  var grids = document.querySelectorAll('[data-exhibit-grid]');
  if (!tpl || !grids.length) return;

  var DEFAULT_CARDS = 1;   // 처음 방문 시 기본으로 놓이는 빈 카드 수
  var MAX_CARDS = 1;       // 한 전시실에 전시할 수 있는 자료 수
  var MAX_EDGE = 1200;     // 저장용 이미지 최대 변 길이(px)
  var JPEG_QUALITY = 0.8;

  /* 자료 종류에 따라 달라지는 글귀 — 도록(export-pdf.js)의 문구와 짝을 맞춘다 */
  var KINDS = {
    artifact: {
      label: '유물 · 문화재',
      photoTitle: '유물 사진 첨부',
      photoAlt: '첨부한 유물 사진',
      desc: {
        label: '유물 설명',
        req: 'ARTIFACT',
        hint: '유물의 이름, 만들어진 시기, 쓰임새와 생김새의 특징을 적어 주세요.'
      },
      event: {
        label: '관련 역사적 사건',
        req: 'HISTORY',
        hint: '이 유물과 연결되는 사건은 무엇이고, 그 사건 속에서 어떤 의미를 갖는지 적어 주세요.'
      }
    },
    event: {
      label: '역사적 사건 사진',
      photoTitle: '사건 사진 첨부',
      photoAlt: '첨부한 역사적 사건 사진',
      desc: {
        label: '사진 속 장면 설명',
        req: 'SCENE',
        hint: '언제, 어디에서 찍은 어떤 장면인지 적어 주세요. 사진 속 인물과 상황, 눈에 띄는 점도 함께 설명해 보세요.'
      },
      event: {
        label: '사건의 배경과 의미',
        req: 'HISTORY',
        hint: '이 사건이 왜 일어났고 어떻게 이어졌는지, 그리고 오늘 우리에게 어떤 의미로 남았는지 적어 주세요.'
      }
    }
  };

  function kindOf(value) {
    return (value === 'event') ? 'event' : 'artifact';
  }

  Array.prototype.forEach.call(grids, function (grid) { initRoom(grid); });

  /* =======================================================
     전시실 하나를 담당한다
     ======================================================= */
  function initRoom(grid) {

    // 버튼과 안내 문구는 같은 전시실 영역 안에서만 찾는다
    var scope = grid.closest('.room-section') || document;
    var addBtn = scope.querySelector('[data-add-card]');
    var stateEl = scope.querySelector('[data-save-state]');

    var ROOM_ID = grid.getAttribute('data-room') || 'room';
    var STORAGE_KEY = 'museum-exhibit:' + ROOM_ID;

    /* ---------- 상태 표시 ---------- */
    var stateTimer = null;
    function setState(text, isError) {
      if (!stateEl) return;
      stateEl.textContent = text;
      stateEl.classList.toggle('is-error', !!isError);
      clearTimeout(stateTimer);
      if (!isError) {
        stateTimer = setTimeout(function () {
          stateEl.textContent = '입력한 내용은 이 브라우저에 자동 저장됩니다';
        }, 2000);
      }
    }

    /* ---------- 저장 / 불러오기 ---------- */
    var saveTimer = null;

    function collect() {
      return Array.prototype.map.call(grid.querySelectorAll('[data-card]'), function (card) {
        return {
          kind: kindOf(card.getAttribute('data-kind')),
          photo: card.querySelector('[data-photo]').getAttribute('src') || '',
          desc: card.querySelector('[data-desc]').value,
          event: card.querySelector('[data-event]').value
        };
      });
    }

    function save() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(collect()));
          setState('저장됨 ✓');
          // 로비의 작성 상태 표시를 갱신하도록 알린다
          document.dispatchEvent(new CustomEvent('exhibit:saved', { detail: { room: ROOM_ID } }));
        } catch (err) {
          setState('저장 공간이 부족합니다. 용량이 작은 사진을 사용하세요.', true);
        }
      }, 350);
    }

    function load() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (err) {
        return null;
      }
    }

    /* ---------- textarea 자동 높이 ---------- */
    function autoGrow(el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }

    /* ---------- 이미지 축소 후 데이터 URL로 변환 ---------- */
    function toDataURL(file, done, fail) {
      if (!file || file.type.indexOf('image/') !== 0) {
        fail('이미지 파일만 첨부할 수 있습니다.');
        return;
      }

      var reader = new FileReader();
      reader.onerror = function () { fail('사진을 읽지 못했습니다.'); };
      reader.onload = function (e) {
        var img = new Image();
        // 원본을 그대로 쓰면 저장 용량을 넘기기 쉬워 축소 후 저장한다
        img.onerror = function () { done(e.target.result); };
        img.onload = function () {
          var scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
          var w = Math.round(img.width * scale);
          var h = Math.round(img.height * scale);

          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;

          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';           // 투명 PNG 대비
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);

          try {
            done(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
          } catch (err) {
            done(e.target.result);
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    /* ---------- 사진 적용 / 해제 ---------- */
    function setPhoto(card, dataURL) {
      var photo = card.querySelector('[data-photo]');
      photo.src = dataURL;
      photo.hidden = false;
      card.classList.add('has-photo');
      card.querySelector('[data-photo-remove]').hidden = false;
    }

    function clearPhoto(card) {
      var photo = card.querySelector('[data-photo]');
      photo.removeAttribute('src');
      photo.hidden = true;
      card.classList.remove('has-photo');
      card.querySelector('[data-photo-remove]').hidden = true;
      card.querySelector('[data-file]').value = '';
    }

    function handleFile(card, file) {
      toDataURL(file, function (url) {
        setPhoto(card, url);
        save();
      }, function (msg) {
        setState(msg, true);
      });
    }

    /* ---------- 자료 종류 적용 ----------
       고른 종류에 맞춰 라벨·안내 문구를 갈아 끼운다.
       이미 쓴 글은 건드리지 않고, 빈 칸의 예시 문구만 바꾼다. */
    function applyKind(card, value) {
      var kind = kindOf(value);
      var K = KINDS[kind];

      card.setAttribute('data-kind', kind);
      card.querySelector('[data-kind-label]').textContent = K.label;
      card.querySelector('[data-dz-title]').textContent = K.photoTitle;
      card.querySelector('[data-photo]').alt = K.photoAlt;

      card.querySelector('[data-label-desc]').textContent = K.desc.label;
      card.querySelector('[data-req-desc]').textContent = K.desc.req;
      card.querySelector('[data-desc]').placeholder = K.desc.hint;

      card.querySelector('[data-label-event]').textContent = K.event.label;
      card.querySelector('[data-req-event]').textContent = K.event.req;
      card.querySelector('[data-event]').placeholder = K.event.hint;

      card.querySelector('[data-remove]').setAttribute(
        'aria-label', K.label + ' 카드 삭제');
    }

    /* ---------- 카드 만들기 ---------- */
    var cardSeq = 0;

    function createCard(data) {
      var card = tpl.content.firstElementChild.cloneNode(true);
      var fileInput = card.querySelector('[data-file]');
      var dropzone = card.querySelector('[data-dropzone]');
      var desc = card.querySelector('[data-desc]');
      var event = card.querySelector('[data-event]');

      // 저장된 내용 복원
      var kind = kindOf(data && data.kind);
      if (data) {
        if (data.photo) setPhoto(card, data.photo);
        desc.value = data.desc || '';
        event.value = data.event || '';
      }

      // 자료 종류 고르기 (라디오 이름은 카드마다 달라야 한다)
      var group = 'kind-' + ROOM_ID + '-' + (++cardSeq);
      Array.prototype.forEach.call(card.querySelectorAll('[data-kind]'), function (radio) {
        radio.name = group;
        radio.checked = (radio.value === kind);
        radio.addEventListener('change', function () {
          if (!radio.checked) return;
          applyKind(card, radio.value);
          save();
        });
      });
      applyKind(card, kind);

      // 사진 선택
      fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files[0]) handleFile(card, fileInput.files[0]);
      });

      // 드래그앤드롭
      ['dragenter', 'dragover'].forEach(function (type) {
        dropzone.addEventListener(type, function (e) {
          e.preventDefault();
          dropzone.classList.add('is-dragover');
        });
      });
      ['dragleave', 'drop'].forEach(function (type) {
        dropzone.addEventListener(type, function () {
          dropzone.classList.remove('is-dragover');
        });
      });
      dropzone.addEventListener('drop', function (e) {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleFile(card, e.dataTransfer.files[0]);
        }
      });

      // 사진 삭제 (첨부 영역 위에 겹쳐 있어 파일 선택창이 함께 열리지 않도록 차단)
      card.querySelector('[data-photo-remove]').addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        clearPhoto(card);
        save();
      });

      // 텍스트 입력
      [desc, event].forEach(function (ta) {
        ta.addEventListener('input', function () {
          autoGrow(ta);
          save();
        });
      });

      // 카드 삭제
      card.querySelector('[data-remove]').addEventListener('click', function () {
        if (!window.confirm('이 카드를 삭제할까요? 입력한 내용도 함께 지워집니다.')) return;
        card.remove();
        renumber();
        save();
      });

      return card;
    }

    /* ---------- 번호 다시 매기기 / 빈 상태 ---------- */
    function renumber() {
      var cards = grid.querySelectorAll('[data-card]');
      Array.prototype.forEach.call(cards, function (card, i) {
        var no = ('0' + (i + 1)).slice(-2);
        var kind = KINDS[kindOf(card.getAttribute('data-kind'))];
        card.querySelector('[data-index]').textContent = 'EXHIBIT ' + no;
        card.querySelector('[data-remove]').setAttribute(
          'aria-label', no + '번 ' + kind.label + ' 카드 삭제');
      });

      // 정해진 수를 채우면 추가 버튼을 감춘다
      if (addBtn) addBtn.hidden = cards.length >= MAX_CARDS;

      var empty = grid.querySelector('.empty-state');
      if (cards.length === 0) {
        if (!empty) {
          empty = document.createElement('p');
          empty.className = 'empty-state';
          empty.textContent = '전시 중인 자료가 없습니다. 위의 ‘＋ 자료 등록’ 버튼을 눌러 시작하세요.';
          grid.appendChild(empty);
        }
      } else if (empty) {
        empty.remove();
      }
    }

    function addCard(data, focusIt) {
      var card = createCard(data);
      grid.appendChild(card);
      renumber();

      // 높이를 잡으려면 DOM에 붙은 뒤에 계산해야 한다
      autoGrow(card.querySelector('[data-desc]'));
      autoGrow(card.querySelector('[data-event]'));

      if (focusIt) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.querySelector('[data-desc]').focus({ preventScroll: true });
      }
      return card;
    }

    /* ---------- 화면이 열릴 때 높이 다시 맞추기 ----------
       숨어 있는 동안에는 scrollHeight가 0이라 글칸 높이를 잴 수 없다.
       이 전시실이 화면에 나타나면 그때 다시 계산한다. */
    document.addEventListener('view:shown', function (e) {
      if (!e.detail || e.detail.view !== ROOM_ID) return;
      Array.prototype.forEach.call(
        grid.querySelectorAll('[data-desc], [data-event]'),
        function (ta) { autoGrow(ta); }
      );
    });

    /* ---------- 시작 ---------- */
    var saved = load();
    if (saved && saved.length) {
      saved.forEach(function (item) { addCard(item, false); });
    } else {
      for (var i = 0; i < DEFAULT_CARDS; i++) addCard(null, false);
    }
    renumber();

    if (addBtn) {
      addBtn.addEventListener('click', function () {
        if (grid.querySelectorAll('[data-card]').length >= MAX_CARDS) return;
        addCard(null, true);
        save();
      });
    }
  }
})();
