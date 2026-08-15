/* ── 데모 매칭 엔진 ──
   문구집의 「하드코딩 매칭 규칙」을 그대로 옮긴 것이다.
   웹과 앱이 같은 파일을 쓰므로 한쪽만 고쳐져서 어긋날 일이 없다.
   고칠 때는 tools/demo-engine.js를 고치고 tools/build-demo.mjs를 다시 돌린다. */

/* 1. 입력 정규화 — 같은 말인데 형태만 다른 것을 하나로 모은다 */
var DEMO_TYPO = {'어떻해':'어떡해','웬지':'왠지','됬어':'됐어','왜케':'왜 이렇게',
  '어케':'어떻게','머함':'뭐해','머해':'뭐해','넹':'네','넵':'네','ㅇㅇ':'응','ㄴㄴ':'아니'};
var DEMO_EMOJI = [[/[😂🤣ㅋ]/,'웃음'],[/[😭😢ㅠㅜ]/,'울음'],[/[😳😅]/,'당황'],
  [/[😡🤬]/,'분노'],[/[❤️🩷💕♥]/,'하트']];

function demoNorm(t) {
  var s = (t || '').trim().replace(/\s+/g, ' ');
  s = s.replace(/([ㅋㅎㅠㅜ])\1{3,}/g, '$1$1$1$1');       // 최대 넉 자
  s = s.replace(/([!?.~])\1+/g, '$1');                    // 반복 문장부호는 하나로
  Object.keys(DEMO_TYPO).forEach(function (k) {
    s = s.split(k).join(DEMO_TYPO[k]);
  });
  return s;
}
/* 이모지나 자모만 온 입력은 감정 하나로 바꾼다 */
function demoMood(t) {
  var s = (t || '').trim();
  if (!s || /[가-힣a-zA-Z0-9]/.test(s.replace(/[ㅋㅎㅠㅜ]/g, ''))) return '';
  for (var i = 0; i < DEMO_EMOJI.length; i++) if (DEMO_EMOJI[i][0].test(s)) return DEMO_EMOJI[i][1];
  return '';
}
/* 어미와 조사를 떼고 알맹이만 남긴다. "먹었어요"와 "먹었어"가 같은 말이 되게 */
var DEMO_STOP = {'저':1,'제':1,'나':1,'내':1,'너':1,'그':1,'좀':1,'그냥':1,'진짜':1,
  '오늘':1,'지금':1,'우리':1,'이거':1,'그거':1,'뭐':1,'왜':1};
/* 두 자 밑으로는 깎지 않는다.
   "사랑해요"에서 해요를 떼면 "사랑"이 남는데, 거기서 조사 "랑"까지 떼면 "사"다.
   "사과해요"도 똑같이 "사"가 된다. 그래서 사랑한다는 말에 사과를 받았다.
   한 자짜리 어간은 어차피 아무 말이나 걸린다 — 남길 이유가 없다. */
function demoCut(s, re) {
  var c = s.replace(re, '');
  return c.length >= 2 ? c : s;
}
function demoStem(w) {
  var s = w;
  for (var i = 0; i < 3; i++) {
    var b = s;
    s = demoCut(s, /(이에요|예요|에요|이요|해요|어요|아요|네요|나요|까요|군요|거든요|잖아요|는데요|는데|잖아|거든|하죠|하지|더라|드라)$/);
    s = demoCut(s, /(았|었|였|겠|음|슴|기|고|서|면|니|자)$/);
    s = demoCut(s, /(은|는|이|가|을|를|도|의|에|와|과|랑|한테|에게|보다|처럼|까지|부터|만)$/);
    if (s === b) break;
  }
  return s || w;
}
function demoUniq(a) {
  var o = [], seen = {};
  for (var i = 0; i < a.length; i++) if (!seen[a[i]]) { seen[a[i]] = 1; o.push(a[i]); }
  return o;
}
function demoTokens(t) {
  return demoNorm(t).toLowerCase().split(/[^가-힣a-z0-9]+/).filter(Boolean)
    .map(demoStem).filter(function (w) { return w && !DEMO_STOP[w]; });
}
/* 흔한 낱말은 겹쳐도 뜻이 없다. 몇 개 의도에 나오는지로 무게를 매긴다 —
   "있어요"가 겹친 건 단서가 아니고 "떡볶이"가 겹친 건 단서다. */
var DEMO_IDF = null;
function demoIdf(t) {
  if (!DEMO_IDF) {
    DEMO_IDF = {};
    var docs = DEMO_CORPUS.intents.concat(DEMO_CORPUS.follow, DEMO_CORPUS.danger);
    for (var i = 0; i < docs.length; i++) {
      var seen = {};
      (docs[i].q || []).forEach(function (a) {
        demoTokens(a).forEach(function (w) { seen[w] = 1; });
      });
      Object.keys(seen).forEach(function (w) { DEMO_IDF[w] = (DEMO_IDF[w] || 0) + 1; });
    }
    DEMO_IDF._n = docs.length;
  }
  return Math.log(DEMO_IDF._n / (1 + (DEMO_IDF[t] || 0)));
}
/* 띄어쓰기와 문장부호를 뺀 알맹이. 짧은 입력은 이걸로 맞춰야 걸린다 */
/* 자모와 말줄임표를 남긴다 — "ㅋㅋㅋㅋ"나 "……"만 온 입력도 걸려야 한다 */
function demoKey(s) { return demoNorm(s).toLowerCase().replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-z0-9…]/g, ''); }
/* 한쪽이 다른 쪽의 앞부분이면 같은 말로 본다 — "안녕"과 "안녕하세요" */
function demoAlike(a, b) {
  return a === b || (a.length >= 2 && b.length >= 2 && (a.indexOf(b) === 0 || b.indexOf(a) === 0));
}

/* 2~3. 우선순위대로 찾고, 최근에 쓴 답은 뒤로 미룬다 */
function demoState() {
  return { last: '', lastRoom: '', recent: {}, sweet: 0, hurt: 0, same: 0, prev: '' };
}
var DEMO_ST = demoState();

function demoScore(input, entry) {
  var ik = demoKey(input), it = demoTokens(input), best = 0;
  /* 입력에서 제일 드문 낱말. 이게 안 걸린 의도는 화제가 다른 것이다 —
     "왜 좋아해"의 좋아를 놓치면 좋아하는 것 고르기 놀이로 새 버린다. */
  var keyw = '', kv = 0;
  for (var a0 = 0; a0 < it.length; a0++) { var v0 = demoIdf(it[a0]); if (v0 > kv) { kv = v0; keyw = it[a0]; } }
  for (var i = 0; i < entry.q.length; i++) {
    var al = entry.q[i], ak = demoKey(al);
    if (!ak) continue;
    if (ak === ik) return 100;                                   // 4. 완전 일치
    /* 사람은 띄어쓰기를 안 하고 어미를 자른다 — "뭐해"라고 치면 문구집의
       "뭐 해요?"에 안 걸렸다. 낱말로 쪼개도 "뭐"는 흔해서 버려지고 "해요"만
       남으니 영영 안 만난다. 한쪽이 다른 쪽의 앞부분이면 같은 말로 본다.
       길이 차이는 봐야 한다 — 안 그러면 "좋아"가 "좋아하는 색 뭐예요"까지
       삼킨다. 짧은 쪽이 긴 쪽의 2/3은 돼야 같은 말이다. */
    var lo = Math.min(ik.length, ak.length), hi = Math.max(ik.length, ak.length);
    if (lo >= 2 && (ak.indexOf(ik) === 0 || ik.indexOf(ak) === 0) && lo * 3 >= hi * 2) {
      best = Math.max(best, 70 + lo); continue;
    }
    /* 별칭이 입력 안에 통째로 들어 있으면 그건 사실상 같은 말이다.
       다만 입력이 별칭보다 크다는 건 뭔가를 더 얹었다는 뜻이다. 그 얹은 것이
       뚜렷한 낱말이면 화제는 그쪽이다 — "라멘 좋아해?"는 "좋아해"를 통째로
       품고 있지만 고백이 아니라 라멘 얘기다. */
    if (ak.length >= 3 && ik.indexOf(ak) >= 0) {
      if (keyw && kv >= 2.2 && !demoHasTok(al, keyw)) continue;
      best = Math.max(best, 60 + ak.length); continue;
    }
    /* 입력이 별칭의 일부일 때는 그 일부가 별칭의 절반은 돼야 한다.
       "좋아해"가 "단 거 좋아해요?" 안에 들어 있다고 단 거 얘기인 건 아니다.
       그리고 별칭이 덧붙이고 있는 게 뚜렷한 낱말이면 그건 다른 얘기다 —
       "보고 싶어요"는 "삼촌 보고 싶어요"의 일부지만, 빠진 그 두 글자가
       누구를 보고 싶다는 건지를 통째로 바꾼다. 그래서 삼촌을 불러다 주겠다는
       답이 나갔다. */
    if (ik.length >= 4 && ak.indexOf(ik) >= 0 && ik.length * 2 >= ak.length
        && !demoAdds(al, it)) {
      best = Math.max(best, 45 + ik.length); continue;
    }
    /* 같은 낱말이 두 번 나오는 별칭이 있다("바다 좋아해요, 산 좋아해요?").
       겹친 낱말을 두 번 세면 하나만 걸렸는데 둘로 보인다. */
    var at = demoUniq(demoTokens(al)), got = 0, all = 0, n = 0;
    for (var j = 0; j < at.length; j++) {
      var w = demoIdf(at[j]); all += w;
      for (var k = 0; k < it.length; k++) if (demoAlike(at[j], it[k])) { got += w; n++; break; }
    }
    /* 낱말 하나만 겹쳤으면 그게 그 의도의 절반은 돼야 한다.
       "바다 좋아해요, 산 좋아해요?"에 좋아 하나 걸린 건 그 얘기가 아니다. */
    if (n < 2 && all && got / all < 0.5) continue;
    /* 흔한 낱말 하나만 겹친 건 단서가 아니다. "좋아" 하나로 바다·산 고르기를
       집어내면 안 된다. 그럴 때는 차라리 못 알아들었다고 하는 게 낫다. */
    if (got < 1.6) continue;
    var sc = got * 3 + (all ? got / all : 0) * 18;
    /* 입력에 뚜렷한 낱말이 있는데 이 의도에 그게 없으면 화제가 다른 것이다.
       "라멘 좋아해?"의 라멘을 놓치면 좋아 하나 걸렸다고 바다·산 고르기로 샌다.
       깎는 걸로는 못 막는다 — 아예 뺀다. 엉뚱한 답보다 되묻는 편이 낫다. */
    if (keyw && kv >= 2.2) {
      var has = false;
      for (var q0 = 0; q0 < at.length; q0++) if (demoAlike(at[q0], keyw)) { has = true; break; }
      if (!has) continue;
    }
    if (sc > best) best = sc;
  }
  return best;
}
/* 이 별칭이 그 낱말을 갖고 있나 */
function demoHasTok(alias, w) {
  var at = demoTokens(alias);
  for (var i = 0; i < at.length; i++) if (demoAlike(at[i], w)) return true;
  return false;
}

/* 별칭에만 있는 뚜렷한 낱말이 있나. 있으면 그 별칭은 입력보다 좁은 얘기다 */
function demoAdds(alias, it) {
  var at = demoUniq(demoTokens(alias));
  for (var i = 0; i < at.length; i++) {
    if (demoIdf(at[i]) < 2.2) continue;
    var has = false;
    for (var j = 0; j < it.length; j++) if (demoAlike(at[i], it[j])) { has = true; break; }
    if (!has) return true;
  }
  return false;
}

function demoFind(list, input, min) {
  var top = null, tv = min || 0;
  for (var i = 0; i < list.length; i++) {
    if (!list[i].q) continue;
    var v = demoScore(input, list[i]);
    if (v > tv) { tv = v; top = list[i]; }
  }
  return top;
}

/* 설렘 대사는 아껴 쓴다. 매번 나오면 설렘이 아니라 배경이 된다 */
function demoSweet(lines) { return /좋아해|사랑|보고 싶|보고싶|설레|반했|예뻐/.test(lines.join(' ')); }
/* 아프다고 한 직후에는 놀리지 않는다 */
function demoTease(lines) { return /놀리|장난|웃기|치사|삐졌/.test(lines.join(' ')); }

function demoPickFrom(key, cands) {
  if (!cands || !cands.length) return null;
  var seen = DEMO_ST.recent[key] || (DEMO_ST.recent[key] = []);
  var ok = [];
  for (var i = 0; i < cands.length; i++) {
    var c = cands[i], id = c.join('|');
    if (seen.indexOf(id) >= 0) continue;                 // 최근 다섯 번에 쓴 것은 뺀다
    if (DEMO_ST.sweet > 0 && demoSweet(c)) continue;
    if (DEMO_ST.hurt > 0 && demoTease(c)) continue;
    ok.push(c);
  }
  if (!ok.length) { seen.length = 0; ok = cands.slice(); }
  // 두 번 이어서 되묻지 않는다
  if (/[?？]$/.test(DEMO_ST.prev)) {
    var flat = ok.filter(function (c) { return !/[?？]$/.test(c[c.length - 1]); });
    if (flat.length) ok = flat;
  }
  var pick = ok[Math.floor(demoRand() * ok.length)];
  seen.push(pick.join('|')); if (seen.length > 5) seen.shift();
  if (demoSweet(pick)) DEMO_ST.sweet = 10;
  DEMO_ST.prev = pick[pick.length - 1];
  return pick;
}
/* 무작위. 검사에서는 고정할 수 있게 갈아 끼운다 */
var demoRand = Math.random;
function demoSeed(fn) { demoRand = fn || Math.random; }

function demoTick(text) {
  if (DEMO_ST.sweet > 0) DEMO_ST.sweet--;
  DEMO_ST.hurt = /아파|아프|힘들|다쳤|열나|지쳐|지쳤|울었|슬퍼/.test(text || '') ? 3
               : Math.max(0, DEMO_ST.hurt - 1);
  DEMO_ST.same = demoNorm(text) === DEMO_ST.last ? DEMO_ST.same + 1 : 0;
  DEMO_ST.last = demoNorm(text);
}
function demoReset() { DEMO_ST = demoState(); demoPicN = 0; demoPicCool = 0; }

/* 장면 하나를 말풍선 목록으로 편다 */
function demoScript(sc, name) {
  var out = [];
  for (var i = 0; i < sc.length; i++) {
    if (sc[i].sender === 'user') continue;
    for (var j = 0; j < sc[i].text.length; j++)
      out.push({ sender: sc[i].sender, text: demoFill(sc[i].text[j], name) });
  }
  return out;
}
/* 문구집이 자리표시자를 {이름}으로도 {name}으로도 쓴다. 둘 다 받는다 */
function demoFill(t, name) {
  return t.split('{name}').join(name || '선생님').split('{이름}').join(name || '선생님');
}
function demoOut(room, lines, name) {
  return lines.map(function (t) { return { sender: room, text: demoFill(t, name) }; });
}

/* ── 셀카 ──
   민현만 보낸다. 재언은 안 찍는 사람이다.
   그리고 처음부터 주면 그건 셀카가 아니라 프로필 사진이다. 가까워지기
   전에는 미룬다 — 미루는 말이 곧 아까워한다는 표시가 된다.
   가까워진 뒤에도 순순히 주지는 않는다. 조건을 하나씩 붙인다. */
var DEMO_SELFIE_RE = /셀카|얼굴 보여|얼굴 좀|얼굴 보고|얼굴 궁금|사진 보내|사진 줘|사진 보여|사진 좀/;
var DEMO_SELFIE = {
  hold: [['왜요.', '그런 건 안 보내요.'],
         ['갑자기 그런 걸 왜 달래요.'],
         ['좀 있다가요.', '지금은 별로예요.'],
         ['찍은 거 없는데요.', '없다고 했어요.']],
  give: [['알겠어요.', '부끄러운데.'],
         ['한 장만이에요.', '저장은 하지 마요.'],
         ['방금 찍은 거예요.', '딴 사람한테 보여주면 안 돼요.'],
         ['이런 걸 왜 좋아하는지 모르겠지만.', '달라니까 주는 거예요.']],
  /* 재언은 거절하면서 오라고 한다. 안 준다고 끝내는 게 아니라 대신 다른 걸 준다 */
  no:   [['사진 잘 안 찍는데.', '그냥 보러 와요.'],
         ['어디예요?', '가서 보여줄게요.'],
         ['연습하고 보내줄게요.'],
         ['그런 건 민현이한테 물어보세요.']],
};
var DEMO_SELFIE_PHOTO = 'minhyun-mirror';

/* ── 선물 ──
   물건을 받았는데 "무슨 말인지 잘 못 들었어요"가 돌아오면 그건 준 게 아니라
   허공에 던진 것이다. 선물은 문구집보다 먼저 본다 — 열쇠로 바로 찾는다.
   (index.html의 GIFTS·app/lib/profiles.ts의 GIFTS와 열쇠가 같아야 한다)

   둘 다 고맙다는 말을 먼저 하지 않는다. 재언은 쓸모부터 따지고 나서 받고,
   민현은 안 쓴다고 해놓고 쓰겠다고 한다. 그게 이 둘이 고마워하는 방식이다.

   ※ 이 대사는 전부 제가 쓴 것이다. 마음에 안 들면 여기만 고치면 된다. */
var DEMO_GIFT = {
  mug: {
    jaeeon:  [['컵은 있는데요.', '이걸로 마실게요.']],
    minhyun: [['저 커피 안 마시는데요.', '그래도 쓸게요. 물 마실 때.']],
  },
  photobook: {
    jaeeon:  [['사진집은 오랜만이네요.', '겨울 사진만 있네요. 왜 겨울이에요?']],
    minhyun: [['이런 거 볼 줄 알아요?', '저 겨울 싫어하는데. 이건 괜찮네요.']],
  },
  beanie: {
    jaeeon:  [['머리 눌리는데.', '안 쓰면 아깝겠네요.']],
    minhyun: [['저 이런 거 안 쓰는데.', '쓰고 갈게요. 내일.']],
  },
  earphone: {
    jaeeon:  [['선 있는 걸로 주셨네요.', '잃어버릴 일은 없겠어요.']],
    minhyun: [['한쪽은 누구 주라고요?', '안 줘요. 둘 다 제가 쓸 거예요.']],
  },
  hotpack: {
    jaeeon:  [['손이 찬 편이긴 해요.', '흔들면 되는 거죠.']],
    minhyun: [['제 손 찬 거 어떻게 알았어요?', '말한 적 없는데.']],
  },
  umbrella: {
    jaeeon:  [['차에 하나 있는데.', '가방에 넣어둘게요.']],
    minhyun: [['비 오면 그냥 맞는데요.', '이제 안 맞을게요.']],
  },
  hanky: {
    jaeeon:  [['손 자주 씻는 건 어떻게 알았어요.', '잘 쓸게요.']],
    minhyun: [['이런 거 쓰는 사람 처음 봐요.', '저도 갖고 다닐게요.']],
  },
  camera: {
    jaeeon:  [['스물네 장이면 아껴 찍어야겠네요.', '뭘 찍으라고요.']],
    minhyun: [['이걸로 뭘 찍어요?', '선생님 찍어도 돼요?']],
  },
  scarf: {
    jaeeon:  [['두 번 감기네요.', '목만 따뜻해도 다르다고들 하죠.']],
    minhyun: [['이거 색이 좀.', '그래도 할게요. 추우니까.']],
  },
  gloves: {
    jaeeon:  [['손 트기 전에 주셨네요.', '고맙습니다.']],
    minhyun: [['주머니 있는데요.', '손 시린 거 어떻게 알았어요.']],
  },
  bandana: {
    jaeeon:  [['이건 저보다 민현이가 하겠는데요.', '일단 받아둘게요.']],
    minhyun: [['왜 묶고 다니는지 안 물어봤잖아요.', '이제 물어봐도 돼요.']],
  },
  candy: {
    jaeeon:  [['저 말 많이 안 하는데요.', '그래도 하나 먹을게요.']],
    minhyun: [['이거 이제 제 건데요.', '하나 드려요?']],
  },
  ramen: {
    jaeeon:  [['이건 민현이가 좋아하겠네요.', '저는 따로 챙겨 먹을게요.']],
    minhyun: [['이거 하나로 되겠어요?', '같이 먹을 사람은요.']],
  },
  coffee: {
    jaeeon:  [['아침이 급한 건 어떻게 알았어요.', '내일 마실게요.']],
    minhyun: [['저 커피 마시면 잠 안 오는데.', '그럼 밤에 마셔야겠네요.']],
  },
  letter: {
    jaeeon:  [['쓸 말이 있어야 쓰죠.', '한 장은 쓸게요.']],
    minhyun: [['편지 써서 뭐 해요.', '쓰면 읽어줄 거예요?']],
  },
  mixcd: {
    jaeeon:  [['목록이 없네요.', '들으면서 맞혀보라는 거죠.']],
    minhyun: [['열두 곡이나요.', '다 들을 때까지 안 갈 거죠?']],
  },
};
/* 열쇠가 없는 물건을 줬을 때. 새 선물을 넣고 표를 안 채웠을 때 여기로 온다 */
var DEMO_GIFT_ANY = {
  jaeeon:  [['뭐 이런 걸.', '잘 쓸게요.'],
            ['받을 이유가 없는데.', '그래도 받을게요.']],
  minhyun: [['이걸 왜 줘요.', '안 돌려줄 거예요.'],
            ['저 주는 거 맞아요?', '그럼 가질게요.']],
};
function demoGiftLines(room, key) {
  var g = DEMO_GIFT[key];
  var pool = (g && g[room]) || DEMO_GIFT_ANY[room] || [];
  return demoPickFrom('gift:' + room + ':' + (key || '?'), pool) || [];
}

/* ── 사진 ──
   데모에서도 사진첩이 차야 한다. 서버가 붙여주던 걸 여기서 한다.

   사진은 제 말풍선으로 나간다. 남의 문장 끝에 붙이면 "비 그치면 알려줘요"
   밑에 비 사진이 걸려서, 보내는 사람의 뜻이 아니라 화면 장식이 된다.
   짧게 한 마디 붙여 보내면 그게 사진을 보내는 행동이 된다.

   말에 걸리는 게 있으면 그 사진을, 없으면 가끔 아무거나 — 아무거나가 없으면
   사진첩이 영영 비고, 매번이면 사진첩이 아니라 슬라이드쇼가 된다. */
var DEMO_PIC = [
  [/아프|아파|다쳤|다쳐|상처|멍이|멍 /,  'jaeeon-treat',    'minhyun-corridor'],
  /* "약"만 보면 약속·약간까지 걸린다. 바르고 붙이는 물건일 때만 잡는다 */
  [/연고|밴드|소독|약 발|약을|약은|약 좀/, 'jaeeon-care',   ''],
  [/밥|먹었|먹을|점심|저녁|배고/,        'jaeeon-cook',     'minhyun-ramen'],
  [/사탕|단 거|단거/,                    'jaeeon-cabinet',  'minhyun-candy'],
  [/커피/,                               'jaeeon-mug',      ''],
  [/비 |비가|비와|비 와|장마/,           'jaeeon-car',      'minhyun-rain'],
  [/눈 |눈이|겨울|춥/,                   'jaeeon-evening',  'minhyun-snow'],
  /* "자" 한 자는 감자·의자·혼자에까지 걸렸다. 자는 얘기일 때만 */
  [/자요|자니|잤|잘 거|졸려|졸음|잠 /,   '',                'minhyun-nap'],
  [/옥상/,                               'jaeeon-rooftop',  'minhyun-stair'],
  [/편의점/,                             'jaeeon-market',   'minhyun-conv'],
  [/빨래|세탁/,                          'jaeeon-laundry',  'minhyun-laundry'],
  [/버스|정류장/,                        '',                'minhyun-busstop'],
  [/담배|라이터|골목/,                   '',                'minhyun-alley'],
  [/수업|교실|학교/,                     'jaeeon-classroom','minhyun-desk'],
  [/운동|체육/,                          '',                'minhyun-gym'],
  [/노래|음악|이어폰/,                   'jaeeon-shelf',    'minhyun-window'],
  [/보건실/,                             'jaeeon-sink',     'minhyun-nap'],
];
var DEMO_PIC_ANY = {
  jaeeon: ['jaeeon-work','jaeeon-door','jaeeon-chart','jaeeon-bottle','jaeeon-curtain',
           'jaeeon-bandage','jaeeon-driveseat','jaeeon-corridor','jaeeon-back'],
  minhyun:['minhyun-gate','minhyun-conv','minhyun-vending','minhyun-neon','minhyun-bench',
           'minhyun-morning','minhyun-winter','minhyun-mirror'],
};
/* 사진에 붙는 한 마디. 앞말이 무엇이든 어긋나지 않는 것만 둔다 —
   사진 자체가 하는 말이지 사진에 대한 설명이 아니다. */
var DEMO_PIC_SAY = {
  jaeeon:  ['이거요.', '보세요.', '지금 이래요.', '여기요.'],
  minhyun: ['이거요.', '봐요.', '지금요.', '방금 찍었어요.'],
};
var demoPicN = 0, demoPicCool = 0;
function demoPhoto(room, text) {
  if (demoPicCool > 0) { demoPicCool--; return ''; }     // 연달아 보내지 않는다
  var i = room === 'jaeeon' ? 1 : 2;
  for (var k = 0; k < DEMO_PIC.length; k++)
    if (DEMO_PIC[k][i] && DEMO_PIC[k][0].test(text || '')) { demoPicCool = 3; return DEMO_PIC[k][i]; }
  if (++demoPicN % 9 !== 0) return '';
  var pool = DEMO_PIC_ANY[room] || [];
  if (!pool.length) return '';
  demoPicCool = 5;
  return pool[Math.floor(demoRand() * pool.length)];
}

/* 방마다 고르는 법이 다르다.
   관전방에서 유저는 장면 밖의 관찰자다 — 유저 입력은 장면 지시로 처리하고
   출력에는 두 사람의 대화만 나온다. 단톡방은 유저가 그 안에 있다. */
function demoAnswer(room, text, name, opts) {
  var C = DEMO_CORPUS, t = text || '';
  demoTick(t);

  /* 선물이 제일 먼저다. 물건은 이미 도착했으니 못 알아들을 여지가 없다 */
  if (opts && opts.gift && (room === 'jaeeon' || room === 'minhyun'))
    return demoOut(room, demoGiftLines(room, opts.gift), name);

  // 셀카는 문구집보다 먼저 본다. 사진이 붙는 답이라 다른 결과 섞이면 안 된다
  if (DEMO_SELFIE_RE.test(t) && (room === 'jaeeon' || room === 'minhyun')) {
    if (room === 'jaeeon')
      return demoOut(room, demoPickFrom('selfie:j', DEMO_SELFIE.no) || [], name);
    var close = !!(opts && opts.close);
    var lines = demoPickFrom('selfie:' + (close ? 'give' : 'hold'),
                             close ? DEMO_SELFIE.give : DEMO_SELFIE.hold) || [];
    var out = demoOut(room, lines, name);
    if (close && out.length) out[out.length - 1].photo = DEMO_SELFIE_PHOTO;
    return out;
  }

  if (room === 'health') {
    var w = demoFind(C.watch, t, 0);
    var sc = w || C.watch[Math.floor(demoRand() * C.watch.length)];
    return demoScript(sc.script, name);
  }
  if (room === 'group') {
    var g = demoFind(C.group, t, 0);
    if (g) return demoScript(g.script, name);
    return demoScript(C.group[Math.floor(demoRand() * C.group.length)].script, name);
  }

  // 1. 위험·안전이 제일 먼저다. 장난처럼 보여도 그렇다
  var d = demoFind(C.danger, t, 55);
  if (d && d[room]) return demoOut(room, demoPickFrom('danger:' + room, d[room]) || [], name);

  // 2. 직전 대답에서만 열리는 갈래
  if (DEMO_ST.lastRoom === room && DEMO_ST.lastTag) {
    var f = null, fv = 12;
    for (var i = 0; i < C.follow.length; i++) {
      var e = C.follow[i];
      if (!e[room] || !demoAfterOk(e.after, DEMO_ST.lastTag)) continue;
      var v = demoScore(t, e);
      if (v > fv) { fv = v; f = e; }
    }
    if (f) { DEMO_ST.lastTag = ''; return demoOut(room, demoPickFrom('f:' + room, f[room]) || [], name); }
  }

  // 같은 말을 두 번, 세 번 보냈을 때
  if (DEMO_ST.same >= 1) {
    var r = C.repeat[Math.min(DEMO_ST.same - 1, C.repeat.length - 1)];
    if (r && r[room]) return demoOut(room, demoPickFrom('rep:' + room, r[room]) || [], name);
  }

  // 4~6. 완전 일치 → 여러 핵심어 → 단일 핵심어
  var hit = null, hv = 9;
  for (var k = 0; k < C.intents.length; k++) {
    var en = C.intents[k];
    if (!en[room]) continue;
    var s = demoScore(t, en);
    if (s > hv) { hv = s; hit = en; }
  }
  if (hit) {
    DEMO_ST.lastTag = hit.q[0]; DEMO_ST.lastRoom = room;
    var res = demoOut(room, demoPickFrom('i:' + room + ':' + hit.q[0], hit[room]) || [], name);
    var pic = demoPhoto(room, t);
    if (pic && res.length) {
      var say = DEMO_PIC_SAY[room] || ['이거요.'];
      res.push({ sender: room, text: say[Math.floor(demoRand() * say.length)], photo: pic });
    }
    return res;
  }
  // 7~8. 알아듣지 못했을 때. 여기서도 빈 손으로 돌아가지 않는다 —
  // 빈 답이 나가면 화면에서 타이핑 표시가 안 꺼진다
  DEMO_ST.lastTag = '';
  var fb = demoPickFrom('fb:' + room, C.fallback[room]);
  return demoOut(room, (fb && fb.length) ? fb : ['무슨 말인지 잘 못 들었어요.'], name);
}
/* 후속 조건은 "재언 — 기다렸어요 계열 다음" 꼴의 한국어 문장이다.
   앞 답의 의도 이름과 겹치는 낱말이 있으면 열어준다. */
function demoAfterOk(after, tag) {
  var a = demoTokens(after || ''), b = demoTokens(tag || '');
  for (var i = 0; i < a.length; i++) if (b.indexOf(a[i]) >= 0) return true;
  return false;
}

/* 지금이 어떤 상황인지. 마지막으로 말한 지 얼마나 됐는지와 시각으로 고른다.
   두 사람 문구집에 다 있는 이름만 돌려준다 — 한쪽에만 있는 이름을 주면
   다른 한쪽은 아무거나 고르게 된다. */
function demoWhen(gapMin, hour) {
  /* 오래 안 온 것과 처음 온 것은 다르다. 방금 깐 사람한테 며칠이나 지났는지
     아냐고 물으면 안 된다. 기록이 아예 없으면 gapMin에 음수가 온다. */
  if (gapMin >= 0) {
  if (gapMin >= 60 * 24 * 3) return '며칠 뒤';
  if (gapMin >= 60 * 20)     return '하루 뒤';
  if (gapMin >= 60 * 3)      return '몇 시간 뒤';
  }
  if (hour >= 23 || hour < 5) return '밤';
  if (hour < 10)              return '아침';
  return '별일 없는 날';
}

/* 캐릭터가 먼저 거는 말. when으로 상황을 고른다(아침·밤·무응답 등) */
function demoProactive(room, when, name) {
  var list = (DEMO_CORPUS.proactive[room] || []).filter(function (p) {
    return !when || (p.when + ' ' + p.sec).indexOf(when) >= 0;
  });
  if (!list.length) list = DEMO_CORPUS.proactive[room] || [];
  if (!list.length) return [];
  var p = list[Math.floor(demoRand() * list.length)];
  return demoOut(room, demoPickFrom('p:' + room + ':' + p.when, p.lines) || [], name);
}
