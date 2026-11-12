(() => {
  'use strict';

  /* ---------- အခြေခံ အချက်အလက် ---------- */
  const DEFAULTS = { wake: '10:00', breakfast: '10:30', lunch: '15:00', dinner: '20:00', bed: '01:00' };
  const STORE_KEY = 'med-meal-tracker-v1';
  const MISSED_AFTER = 60;   // မိနစ် — ဤမျှကျော်လျှင် "လွတ်သွားပြီ" ဟု သတ်မှတ်
  const MYONAL_GAP = 240;    // မိနစ် — Myonal တစ်ကြိမ်နှင့်တစ်ကြိမ် အနည်းဆုံး ၄ နာရီ ခြားရန်
  const CLONA_GAP = 120;     // မိနစ် — ညစာနှင့် Clonazepam အနည်းဆုံး ၂ နာရီ ခြားရန်
  const NOTIFY_WINDOW = 30;  // မိနစ် — အချိန်ကျပြီး ဤအတွင်းသာ အသိပေး

  const C_STOMACH = 'အစာအိမ်အက်ဆစ်ပြန်တက်ခြင်း၊ ရင်ပူခြင်း၊ လည်ပင်းတစ်စို့ဖြစ်ခြင်းနှင့် လေတက်ခြင်းများ ဆိုးရွားစွာ ပြန်ဖြစ်လာနိုင်ပါသည်။';
  const MEDS = {
    miracid: { name: 'Miracid', sub: 'Omeprazole', icon: '💊', rule: 'ဗိုက်ထဲ အစာမရှိချိန် — မနက်စာ မစားမီ သောက်ရန်', consequence: C_STOMACH },
    domp:    { name: 'Domp-M', sub: 'အော့အန်/လေတက် သက်သာဆေး', icon: '💊', rule: 'ဗိုက်ထဲ အစာမရှိချိန် — မနက်စာ မစားမီ သောက်ရန်', consequence: C_STOMACH },
    myonal:  { name: 'Myonal', sub: 'Eperisone 50 mg · ကြွက်သားလျော့ဆေး', icon: '💪', rule: 'အစာစားပြီးမှ သောက်ရန် (တစ်နေ့ ၃ ကြိမ်၊ တစ်ကြိမ်နှင့်တစ်ကြိမ် အနည်းဆုံး ၄ နာရီ ခြားရန်)', consequence: 'ကျောအောင့်ခြင်း၊ ကြွက်သားတင်းခြင်းနှင့် ခန္ဓာကိုယ် တောင့်တင်းကိုက်ခဲမှုများ ပြန်ဖြစ်လာနိုင်ပါသည်။' },
    clona:   { name: 'Clonazepam', sub: 'Prenarpil 0.5 mg', icon: '🌙', rule: 'တစ်နေ့ တစ်ကြိမ်၊ ၁ လုံးတည်း — အိပ်ခါနီးမှသာ သီးသန့်သောက်ရန် (ညစာနှင့် အနည်းဆုံး ၂ နာရီ ခြားရန်)', consequence: 'ညဘက် အိပ်မပျော်ခြင်း၊ စိုးရိမ်ပူပန်မှုများ မြင့်တက်ခြင်းနှင့် အိပ်ရေးပျက်ခြင်းတို့ ဖြစ်စေနိုင်ပါသည်။' }
  };
  const MEALS = {
    breakfast: { name: 'မနက်စာ', icon: '🍳' },
    lunch:     { name: 'နေ့လယ်စာ', icon: '🍚' },
    dinner:    { name: 'ညစာ', icon: '🍲' }
  };
  const TOTAL_DOSES = 6;

  /* ---------- အထောက်အကူ function များ ---------- */
  const $ = s => document.querySelector(s);
  const bn = v => String(v).replace(/\d/g, d => '၀၁၂၃၄၅၆၇၈၉'[d]);
  const pad = n => String(n).padStart(2, '0');
  const toMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const WEEKDAYS = ['တနင်္ဂနွေ', 'တနင်္လာ', 'အင်္ဂါ', 'ဗုဒ္ဓဟူး', 'ကြာသပတေး', 'သောကြာ', 'စနေ'];
  const MONTHS = ['ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်', 'ဇူလိုင်', 'ဩဂုတ်', 'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ'];

  function fmtTime(min) {
    const m = ((min % 1440) + 1440) % 1440, h = Math.floor(m / 60), mm = m % 60;
    const period = h < 4 ? 'ည' : h < 12 ? 'မနက်' : h < 16 ? 'နေ့လယ်' : h < 19 ? 'ညနေ' : 'ည';
    return `${period} ${bn(h % 12 || 12)}:${bn(pad(mm))}`;
  }
  function fmtDur(min) {
    const h = Math.floor(min / 60), m = min % 60;
    return (h ? `${bn(h)} နာရီ ` : '') + (m || !h ? `${bn(m)} မိနစ်` : '');
  }
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const keyToDate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };

  /* ---------- သိမ်းဆည်းမှု ---------- */
  let state = { v: 2, uid: null, settings: { ...DEFAULTS }, days: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && saved.settings) {
      state = { v: 2, uid: saved.uid || null, settings: { ...DEFAULTS, ...saved.settings }, days: saved.days || {} };
      // ယခင် version ၏ မူလအချိန်များသည် တစ်ခုနှင့်တစ်ခု နီးလွန်းသဖြင့် အသစ်သို့ ပြောင်းပေးမည်
      if (!saved.v || saved.v < 2) {
        if (state.settings.lunch === '14:00') state.settings.lunch = DEFAULTS.lunch;
        if (state.settings.dinner === '19:00') state.settings.dinner = DEFAULTS.dinner;
      }
    }
  } catch (e) { /* သိမ်းထားချက် မရှိ/မဖတ်နိုင် — မူလတန်ဖိုးသုံးမည် */ }

  function save() { saveLocal(); cloudPush(); }
  function saveLocal() {
    const keys = Object.keys(state.days).sort();
    while (keys.length > 30) delete state.days[keys.shift()];
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------- "ယနေ့" ကို သတ်မှတ်ခြင်း ----------
     ညသန်းခေါင်ကျော်မှ အိပ်သူအတွက် နေ့သစ်ကို အိပ်ရာထချိန် မတိုင်မီ ၃ နာရီမှ စတင်သည်။
     ထို့ကြောင့် ည ၁ နာရီတွင် သောက်ရမည့် အိပ်ဆေးသည် ယခင်နေ့၏ ဇယားထဲတွင်သာ ရှိနေမည်။ */
  function nowInfo() {
    const d = new Date();
    const clock = d.getHours() * 60 + d.getMinutes();
    const boundary = Math.max(0, toMin(state.settings.wake) - 180);
    if (clock < boundary) {
      const y = new Date(d); y.setDate(y.getDate() - 1);
      return { key: dateKey(y), min: clock + 1440, date: y, real: d };
    }
    return { key: dateKey(d), min: clock, date: d, real: d };
  }
  function getDay(key) {
    if (!state.days[key]) state.days[key] = { doses: {}, meals: {}, prn: [], notified: {}, warned: {} };
    return state.days[key];
  }

  /* ---------- အချိန်ဇယား တွက်ချက်ခြင်း ---------- */
  function buildSchedule(day) {
    const s = state.settings, wake = toMin(s.wake);
    const n = m => (m < wake ? m + 1440 : m);
    const eaten = id => day.meals[id];
    const items = [];
    const add = it => { it.order = items.length; items.push(it); };

    add({ id: 'wake', type: 'info', time: wake, title: 'အိပ်ရာထချိန်', icon: '☀️' });
    add({ id: 'miracid', type: 'dose', med: 'miracid', time: wake, when: 'အိပ်ရာထထချင်း' });
    add({ id: 'domp', type: 'dose', med: 'domp', time: wake, when: 'အိပ်ရာထထချင်း' });

    // အစာတစ်နပ်နှင့်တစ်နပ်၊ Myonal တစ်ကြိမ်နှင့်တစ်ကြိမ် အနည်းဆုံး ၄ နာရီ ခြားအောင် အစဉ်လိုက် တွက်သည်။
    // အစာ သို့မဟုတ် ဆေးကို နောက်ကျမှ စား/သောက်ခဲ့လျှင် နောက်အကြိမ်များကို အလိုအလျောက် နောက်ရွှေ့ပေးသည်။
    const WHEN = { breakfast: 'မနက်စာ စားပြီး', lunch: 'နေ့လယ်စာ စားပြီး', dinner: 'ညစာ စားပြီး' };
    let prevMeal = null, prevDose = null, lastMeal = 0;
    ['breakfast', 'lunch', 'dinner'].forEach((mealId, i) => {
      const set = n(toMin(s[mealId]));
      const planned = prevMeal == null ? set : Math.max(set, prevMeal + MYONAL_GAP);
      const mealTime = eaten(mealId) != null ? eaten(mealId) : planned;
      add({ id: mealId, type: 'meal', time: mealTime, shifted: eaten(mealId) == null && planned > set });

      const doseId = 'myonal' + (i + 1), rec = day.doses[doseId];
      const base = eaten(mealId) != null ? mealTime : mealTime + 30;
      const doseTime = prevDose == null ? base : Math.max(base, prevDose + MYONAL_GAP);
      add({ id: doseId, type: 'dose', med: 'myonal', time: doseTime, when: WHEN[mealId], meal: mealId, shifted: doseTime > base ? 'myonal' : null });

      // နောက်အကြိမ်အတွက် ကိုးကားမည့်အချိန် — တကယ်သောက်ခဲ့သောအချိန်၊ မသောက်ရသေးလျှင် စီစဉ်ထားချိန်၊ ကျော်ခဲ့လျှင် မထည့်တွက်
      if (!rec) prevDose = doseTime;
      else if (rec.status === 'taken') prevDose = rec.min;
      prevMeal = mealTime; lastMeal = mealTime;
    });

    const bed = n(toMin(s.bed)), clonaTime = Math.max(bed, lastMeal + CLONA_GAP);
    add({ id: 'clona', type: 'dose', med: 'clona', time: clonaTime, when: 'အိပ်ခါနီး', shifted: clonaTime > bed ? 'clona' : null });

    return items.sort((a, b) => a.time - b.time || a.order - b.order);
  }

  function statusOf(it, day, now) {
    if (it.type === 'info') return now >= it.time ? 'done' : 'upcoming';
    if (it.type === 'meal') return day.meals[it.id] != null ? 'done' : now >= it.time ? 'due' : 'upcoming';
    const rec = day.doses[it.id];
    if (rec) return rec.status; // taken | skipped
    if (now > it.time + MISSED_AFTER) return 'missed';
    return now >= it.time ? 'due' : 'upcoming';
  }
  const titleOf = it => it.type === 'dose' ? MEDS[it.med].name : it.type === 'meal' ? MEALS[it.id].name : it.title;

  /* ---------- ပြသခြင်း ---------- */
  const BTN = 'rounded-xl font-medium px-4 py-2.5 text-sm transition-colors';

  function render() {
    const info = nowInfo(), day = getDay(info.key), items = buildSchedule(day), now = info.min;

    $('#todayDate').textContent = `${WEEKDAYS[info.date.getDay()]}နေ့ · ${bn(info.date.getDate())} ${MONTHS[info.date.getMonth()]} ${bn(info.date.getFullYear())}`;
    $('#clock').textContent = fmtTime(info.real.getHours() * 60 + info.real.getMinutes());

    // တစ်ဆင့်ချင်း — မပြီးသေးသော ပထမဆုံးအရာကိုသာ အဓိကပြမည်
    const steps = items.filter(it => it.type !== 'info');
    const pending = it => ['due', 'upcoming', 'missed'].includes(statusOf(it, day, now));
    const cur = steps.find(pending);
    const taken = Object.values(day.doses).filter(r => r.status === 'taken').length;
    $('#stepCount').textContent = cur ? `အဆင့် ${bn(steps.indexOf(cur) + 1)} / ${bn(steps.length)}` : 'အားလုံး ပြီးပါပြီ';
    $('#progressText').textContent = `ဆေး ${bn(taken)}/${bn(TOTAL_DOSES)} ကြိမ် သောက်ပြီး`;
    $('#stepDots').innerHTML = steps.map(it => {
      const st = statusOf(it, day, now);
      const c = it === cur ? (st === 'missed' ? 'bg-rose-500' : 'bg-amber-400') : st === 'taken' || st === 'done' ? 'bg-emerald-500' : st === 'skipped' ? 'bg-slate-400' : st === 'missed' ? 'bg-rose-300' : 'bg-slate-200';
      return `<span class="h-2 flex-1 rounded-full ${c}"></span>`;
    }).join('');
    $('#stepCard').innerHTML = stepHTML(cur, day, now);

    $('#timeline').innerHTML = items.map(it => itemHTML(it, day, now)).join('');
    renderAdvisories();
    renderPrn(day);
    renderHistory(info.key);
    renderNotifState();
  }

  function stepHTML(it, day, now) {
    if (!it) {
      return `<div class="text-center py-4">
        <div class="mx-auto w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center text-4xl">🎉</div>
        <h2 class="mt-3 text-2xl font-bold text-emerald-700">ယနေ့အတွက် အားလုံး ပြီးပါပြီ</h2>
        <p class="text-slate-500 mt-1">မနက်ဖြန် အိပ်ရာထချိန်တွင် အဆင့် ၁ မှ ပြန်စပါမည်။</p>
      </div>`;
    }
    const st = statusOf(it, day, now), isMeal = it.type === 'meal';
    const info = isMeal ? MEALS[it.id] : MEDS[it.med];
    const status = st === 'missed' ? ['လွတ်နေပါသည် — သတိရသည်နှင့် သောက်ပါ', 'text-rose-600', 'bg-rose-50']
      : st === 'due' ? ['ယခု အချိန်ကျပါပြီ', 'text-amber-600', 'bg-amber-50']
      : [`အချိန်မကျသေးပါ — ${fmtDur(it.time - now)} အကြာတွင်`, 'text-slate-500', 'bg-slate-100'];
    const shifted = it.shifted
      ? `<p class="text-xs text-sky-700 mt-1">⏱ ${isMeal ? 'ယခင်အစာနှင့် ၄ နာရီ ခြားရန်' : it.shifted === 'myonal' ? 'ယခင် Myonal နှင့် အနည်းဆုံး ၄ နာရီ ခြားရန်' : 'ညစာနှင့် အနည်းဆုံး ၂ နာရီ ခြားရန်'} အချိန်ကို နောက်ရွှေ့ထားသည်</p>` : '';
    const big = 'w-full rounded-2xl font-semibold text-lg py-4 transition-colors';
    const buttons = isMeal
      ? `<button data-action="meal-done" data-id="${it.id}" class="${big} bg-sky-600 hover:bg-sky-700 text-white">✓ စားပြီးပြီ</button>`
      : `<button data-action="dose-take" data-id="${it.id}" class="${big} bg-teal-600 hover:bg-teal-700 text-white">✓ သောက်ပြီးပြီ</button>
         <button data-action="dose-skip" data-id="${it.id}" class="w-full rounded-2xl py-3 text-slate-500 hover:bg-slate-50">ဒီတစ်ကြိမ် ကျော်မည်</button>`;
    return `<div class="text-center">
      <div class="mx-auto w-20 h-20 rounded-full ${status[2]} flex items-center justify-center text-4xl ${st === 'due' ? 'ring-pulse' : ''}">${info.icon}</div>
      <p class="mt-3 text-sm font-semibold ${status[1]}">${status[0]}</p>
      <h2 class="text-2xl font-bold text-slate-900 mt-1">${info.name}</h2>
      ${isMeal ? '' : `<p class="text-sm text-slate-500">${info.sub}</p>`}
      <p class="mt-3 text-lg font-semibold text-slate-800">${fmtTime(it.time)}</p>
      <p class="text-sm text-slate-600">${isMeal ? 'အစာစားချိန် — စားပြီးလျှင် နောက်အဆင့်တွင် Myonal သောက်ရန် ပြပါမည်' : `${it.when} · ${info.rule}`}</p>
      ${shifted}
      ${st === 'missed' && !isMeal ? `<div class="mt-3 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-900 text-left"><b>⚠️ မသောက်ရင် ဖြစ်မည့်ဆိုးကျိုး —</b> ${info.consequence}</div>` : ''}
      <div class="mt-5 space-y-1">${buttons}</div>
    </div>`;
  }

  function itemHTML(it, day, now) {
    const st = statusOf(it, day, now);
    const time = `<div class="w-[4.5rem] shrink-0 text-right pt-0.5"><p class="text-sm font-semibold ${st === 'missed' ? 'text-rose-600' : st === 'due' ? 'text-amber-600' : 'text-slate-700'} leading-tight">${fmtTime(it.time)}</p></div>`;

    if (it.type === 'info') {
      return `<li class="flex gap-3 items-center">${time}
        <div class="flex-1 rounded-2xl bg-amber-50 border border-amber-100 px-4 py-2.5 text-amber-900 font-medium">${it.icon} ${it.title}</div></li>`;
    }

    if (it.type === 'meal') {
      const m = MEALS[it.id], done = st === 'done';
      return `<li class="flex gap-3">${time}
        <div class="flex-1 min-w-0 rounded-2xl border px-4 py-3 ${done ? 'bg-emerald-50 border-emerald-200' : st === 'due' ? 'bg-white border-amber-300 ring-pulse' : 'bg-white border-slate-200'}">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="min-w-0">
              <p class="font-semibold text-slate-800">${m.icon} ${m.name}</p>
              <p class="text-sm ${done ? 'text-emerald-700' : st === 'due' ? 'text-amber-700' : 'text-slate-500'}">${done ? `✓ ${fmtTime(day.meals[it.id])} တွင် စားပြီး` : st === 'due' ? 'အစာစားချိန် ရောက်ပါပြီ' : 'အစာစားချိန်'}</p>
              ${it.shifted ? '<p class="text-xs text-sky-700">⏱ ယခင်အစာနှင့် ၄ နာရီ ခြားရန် အချိန်ကို နောက်ရွှေ့ထားသည်</p>' : ''}
            </div>
            ${done
              ? `<button data-action="meal-undo" data-id="${it.id}" class="text-sm text-slate-500 underline underline-offset-4">ပြန်ပြင်မည်</button>`
              : `<button data-action="meal-done" data-id="${it.id}" class="${BTN} bg-sky-600 hover:bg-sky-700 text-white">စားပြီးပြီ</button>`}
          </div>
        </div></li>`;
    }

    const med = MEDS[it.med], rec = day.doses[it.id];
    const box = {
      taken: 'bg-emerald-50 border-emerald-200',
      skipped: 'bg-slate-50 border-slate-300',
      missed: 'bg-rose-50 border-rose-300',
      due: 'bg-white border-amber-300 ring-pulse',
      upcoming: 'bg-white border-slate-200'
    }[st];
    const badge = {
      taken: `<span class="text-xs font-semibold bg-emerald-600 text-white rounded-full px-2.5 py-0.5">✓ သောက်ပြီး${rec ? ' · ' + fmtTime(rec.min) : ''}</span>`,
      skipped: '<span class="text-xs font-semibold bg-slate-500 text-white rounded-full px-2.5 py-0.5">ကျော်လိုက်သည်</span>',
      missed: '<span class="text-xs font-semibold bg-rose-600 text-white rounded-full px-2.5 py-0.5">လွတ်သွားပြီ</span>',
      due: '<span class="text-xs font-semibold bg-amber-500 text-white rounded-full px-2.5 py-0.5">အချိန်ကျပြီ</span>',
      upcoming: ''
    }[st];
    const warn = (st === 'missed' || st === 'skipped')
      ? `<div class="mt-2 rounded-xl bg-rose-100 border border-rose-200 px-3 py-2 text-sm text-rose-900"><b>⚠️ မသောက်ရင် ဖြစ်မည့်ဆိုးကျိုး —</b> ${med.consequence}</div>` : '';
    const actions = rec
      ? `<button data-action="dose-undo" data-id="${it.id}" class="text-sm text-slate-500 underline underline-offset-4">ပြန်ပြင်မည်</button>`
      : `<button data-action="dose-take" data-id="${it.id}" class="${BTN} bg-teal-600 hover:bg-teal-700 text-white">✓ သောက်ပြီးပြီ</button>
         <button data-action="dose-skip" data-id="${it.id}" class="${BTN} bg-white border border-slate-300 text-slate-600 hover:bg-slate-50">ကျော်မည်</button>`;

    return `<li class="flex gap-3">${time}
      <div class="flex-1 min-w-0 rounded-2xl border px-4 py-3 ${box}">
        <div class="flex items-start justify-between gap-2 flex-wrap">
          <p class="font-semibold text-slate-800 ${st === 'skipped' ? 'line-through decoration-slate-400' : ''}">${med.icon} ${med.name} <span class="font-normal text-sm text-slate-500">(${med.sub})</span></p>
          ${badge}
        </div>
        <p class="text-sm text-slate-600">${it.when} · ${med.rule}</p>
        ${!rec && it.shifted ? `<p class="text-xs text-sky-700 mt-1">⏱ ${it.shifted === 'myonal' ? 'ယခင် Myonal နှင့် အနည်းဆုံး ၄ နာရီ ခြားရန်' : 'ညစာနှင့် အနည်းဆုံး ၂ နာရီ ခြားရန်'} အချိန်ကို နောက်ရွှေ့ထားသည်</p>` : ''}
        ${warn}
        <div class="mt-2.5 flex items-center gap-2 flex-wrap">${actions}</div>
      </div></li>`;
  }

  function renderAdvisories() {
    const s = state.settings, wake = toMin(s.wake), n = m => (m < wake ? m + 1440 : m);
    const b = n(toMin(s.breakfast)), l = n(toMin(s.lunch)), d = n(toMin(s.dinner)), bed = n(toMin(s.bed));
    const out = [];
    if (b - wake < 30) out.push('Miracid နှင့် Domp-M သည် အစာမစားမီ သောက်ရသောဆေးဖြစ်၍ အိပ်ရာထချိန်နှင့် မနက်စာကြား အနည်းဆုံး မိနစ် ၃၀ ခြားထားရန် အကြံပြုပါသည်။');
    if (!(b < l && l < d)) out.push('အစာစားချိန်များ အစဉ်လိုက် မဖြစ်နေပါ — မနက်စာ၊ နေ့လယ်စာ၊ ညစာ အစီအစဉ်အတိုင်း ပြန်စစ်ပါ။');
    else if (l - b < MYONAL_GAP || d - l < MYONAL_GAP) out.push('အစာစားချိန်များကြား ၄ နာရီ မခြားပါ — Myonal တစ်ကြိမ်နှင့်တစ်ကြိမ် အနည်းဆုံး ၄ နာရီ ခြားစေရန် ဇယားထဲတွင် အချိန်ကို အလိုအလျောက် နောက်ရွှေ့ပေးထားပါသည်။');
    if (bed <= d) out.push('အိပ်ရာဝင်ချိန်သည် ညစာထက် စောနေပါသည် — အချိန်ကို ပြန်စစ်ပါ။');
    else if (bed - d < CLONA_GAP) out.push('ညစာနှင့် အိပ်ရာဝင်ချိန်ကြား ၂ နာရီ မခြားပါ — Clonazepam သောက်ချိန်ကို ညစာပြီး ၂ နာရီအကြာသို့ ရွှေ့ပေးထားပါသည်။');
    $('#advisories').innerHTML = out.map(t => `<p class="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm px-3 py-2">💡 ${t}</p>`).join('');
  }

  function renderPrn(day) {
    $('#prnLog').innerHTML = day.prn.length
      ? `<p class="text-sm text-slate-600 mb-2">ယနေ့ ${bn(day.prn.length)} ကြိမ် သောက်ထားသည်</p>
         <div class="flex flex-wrap gap-2">${day.prn.map((m, i) => `<span class="inline-flex items-center gap-1.5 bg-violet-50 border border-violet-200 text-violet-800 text-sm rounded-full pl-3 pr-1.5 py-0.5">${fmtTime(m)}<button data-action="prn-remove" data-id="${i}" class="w-6 h-6 rounded-full hover:bg-violet-200 leading-none" aria-label="ဖျက်မည်">×</button></span>`).join('')}</div>`
      : '<p class="text-sm text-slate-400">ယနေ့ မသောက်ရသေးပါ</p>';
  }

  function renderHistory(todayKey) {
    const base = keyToDate(todayKey), cells = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base); d.setDate(d.getDate() - i);
      const day = state.days[dateKey(d)];
      const taken = day ? Object.values(day.doses).filter(r => r.status === 'taken').length : 0;
      const pct = Math.round(taken / TOTAL_DOSES * 100);
      const color = !day ? 'bg-slate-200' : pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-400';
      cells.push(`<div class="text-center">
        <div class="h-20 bg-slate-100 rounded-lg flex items-end overflow-hidden"><div class="w-full ${color} rounded-lg" style="height:${Math.max(pct, 6)}%"></div></div>
        <p class="text-xs font-semibold text-slate-700 mt-1">${bn(taken)}/${bn(TOTAL_DOSES)}</p>
        <p class="text-[11px] ${i === 0 ? 'text-teal-700 font-semibold' : 'text-slate-500'}">${i === 0 ? 'ယနေ့' : `${bn(d.getDate())}/${bn(d.getMonth() + 1)}`}</p>
      </div>`);
    }
    $('#history').innerHTML = cells.join('');
  }

  /* ---------- ဘေးဘက် menu နှင့် စာမျက်နှာများ ---------- */
  function setDrawer(open) {
    $('#drawer').classList.toggle('-translate-x-full', !open);
    $('#drawerShade').classList.toggle('hidden', !open);
  }
  function showView(id) {
    document.querySelectorAll('[data-view]').forEach(el => el.classList.toggle('hidden', el.dataset.view !== id));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.id === id));
    setDrawer(false);
    window.scrollTo(0, 0);
  }

  /* ---------- Popup ---------- */
  let modalOpen = false, modalActions = [];
  function openModal({ tone = 'rose', icon = '⚠️', title, body, actions }) {
    const tones = { rose: 'bg-rose-600', amber: 'bg-amber-500', teal: 'bg-teal-600' };
    modalActions = actions;
    $('#modalCard').innerHTML = `
      <div class="${tones[tone]} text-white px-5 py-4 rounded-t-2xl"><p class="text-3xl">${icon}</p><h3 class="text-lg font-bold mt-1 leading-snug">${title}</h3></div>
      <div class="px-5 py-4 text-slate-700 space-y-3">${body}</div>
      <div class="px-5 pb-5 flex flex-col gap-2">${actions.map((a, i) => `<button data-modal="${i}" class="${BTN} w-full py-3 ${a.primary ? 'bg-teal-600 hover:bg-teal-700 text-white' : a.danger ? 'bg-white border border-rose-300 text-rose-700 hover:bg-rose-50' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}">${a.label}</button>`).join('')}</div>`;
    $('#modal').classList.remove('hidden');
    modalOpen = true;
  }
  function closeModal() { $('#modal').classList.add('hidden'); modalOpen = false; }
  $('#modal').addEventListener('click', e => {
    const b = e.target.closest('[data-modal]');
    if (!b) return;
    const a = modalActions[+b.dataset.modal];
    closeModal();
    if (a.fn) a.fn();
    render();
  });

  const consequenceBox = med => `<div class="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3"><p class="font-semibold text-rose-800">${med.icon} ${med.name} — မသောက်ရင် ဖြစ်မည့်ဆိုးကျိုး</p><p class="text-rose-900 mt-1">${med.consequence}</p></div>`;

  /* ---------- လုပ်ဆောင်ချက်များ ---------- */
  function takeDose(id) {
    const info = nowInfo();
    getDay(info.key).doses[id] = { status: 'taken', min: info.min };
    save(); toast('✓ မှတ်တမ်းတင်ပြီးပါပြီ', 'teal');
  }

  function onAction(action, id) {
    const info = nowInfo(), day = getDay(info.key), items = buildSchedule(day);
    const it = items.find(x => x.id === id);

    if (action === 'dose-take') {
      // Clonazepam ကို အိပ်ရာဝင်ချိန်မတိုင်မီ စော၍ သောက်ရန် ကြိုးစားလျှင် သတိပေးမည်
      if (it.med === 'clona' && info.min < it.time - 60) {
        openModal({
          tone: 'amber', icon: '🌙', title: 'Clonazepam ကို အိပ်ရာဝင်ချိန်တွင်သာ သောက်ရပါမည်',
          body: `<p>သတ်မှတ်ထားသော အိပ်ရာဝင်ချိန်မှာ <b>${fmtTime(it.time)}</b> ဖြစ်ပြီး <b>${fmtDur(it.time - info.min)}</b> လိုပါသေးသည်။</p><p>စော၍သောက်ပါက နေ့ခင်းဘက် ငိုက်မျဉ်းခြင်း၊ မူးဝေခြင်း ဖြစ်နိုင်ပါသည်။ ယခု အမှန်တကယ် အိပ်ရာဝင်တော့မည်ဆိုမှသာ သောက်ပါ။</p>`,
          actions: [
            { label: 'အိပ်ရာဝင်ချိန်ကျမှ သောက်မည်', primary: true },
            { label: 'ယခု အိပ်ရာဝင်တော့မည် — သောက်ပြီးပြီ', fn: () => takeDose(id) }
          ]
        });
        return;
      }
      // Myonal ကို ယခင်အကြိမ်နှင့် ၄ နာရီ မခြားဘဲ သောက်ရန် ကြိုးစားလျှင် သတိပေးမည်
      if (it.med === 'myonal') {
        const prev = ['myonal1', 'myonal2', 'myonal3'].filter(k => k !== id && day.doses[k] && day.doses[k].status === 'taken').map(k => day.doses[k].min);
        const last = prev.length ? Math.max(...prev) : null;
        if (last != null && info.min - last < MYONAL_GAP) {
          openModal({
            tone: 'rose', icon: '⏱', title: 'Myonal ကို ဆက်တိုက် မသောက်ပါနှင့်',
            body: `<p>ယခင် Myonal ကို <b>${fmtTime(last)}</b> တွင် သောက်ထားပြီး <b>${fmtDur(info.min - last)}</b> သာ ရှိပါသေးသည်။</p><p>တစ်ကြိမ်နှင့်တစ်ကြိမ် <b>အနည်းဆုံး ၄ နာရီ</b> ခြားရပါမည်။ နောက်တစ်ကြိမ်ကို <b>${fmtTime(last + MYONAL_GAP)}</b> နောက်ပိုင်းမှ သောက်ပါ။</p>`,
            actions: [
              { label: `${fmtTime(last + MYONAL_GAP)} ကျမှ သောက်မည်`, primary: true },
              { label: 'သောက်ပြီးသွားပြီ — မှတ်တမ်းတင်မည်', danger: true, fn: () => takeDose(id) }
            ]
          });
          return;
        }
      }
      // Myonal ကို အစာမစားရသေးဘဲ သောက်ရန် ကြိုးစားလျှင် သတိပေးမည်
      const mealId = it.meal;
      if (mealId && day.meals[mealId] == null) {
        openModal({
          tone: 'amber', icon: '🍽️', title: `${MEALS[mealId].name} စားပြီးပြီလား?`,
          body: `<p>Myonal ကို <b>အစာစားပြီးမှ</b> သောက်ရပါမည်။ ${MEALS[mealId].name} စားပြီးကြောင်း မမှတ်ရသေးပါ။</p>`,
          actions: [
            { label: 'စားပြီးပြီ — ဆေးလည်း သောက်ပြီးပြီ', primary: true, fn: () => { getDay(info.key).meals[mealId] = nowInfo().min; takeDose(id); } },
            { label: 'မစားရသေးပါ — စားပြီးမှ သောက်မည်' }
          ]
        });
        return;
      }
      takeDose(id);
    }

    else if (action === 'dose-skip') {
      const med = MEDS[it.med];
      openModal({
        tone: 'rose', icon: '⚠️', title: `${med.name} ကို တကယ် ကျော်မလား?`,
        body: consequenceBox(med) + `<p class="text-sm text-slate-600">ဆရာဝန်ညွှန်ကြားထားသည့်အတိုင်း ပုံမှန်သောက်မှသာ ရောဂါသက်သာမည်ဖြစ်ပါသည်။</p>`,
        actions: [
          { label: '✓ ပြန်စဉ်းစားပြီ — ဆေးသောက်မည်', primary: true },
          { label: 'သိပါသည် — ဒီတစ်ကြိမ် ကျော်မည်', danger: true, fn: () => { getDay(info.key).doses[id] = { status: 'skipped', min: nowInfo().min }; save(); } }
        ]
      });
      return;
    }

    else if (action === 'dose-undo') { delete day.doses[id]; day.warned[id] = true; }
    else if (action === 'meal-done') { day.meals[id] = info.min; toast(`✓ ${MEALS[id].name} စားပြီးကြောင်း မှတ်ပြီးပါပြီ`, 'teal'); }
    else if (action === 'meal-undo') { delete day.meals[id]; }
    else if (action === 'prn-add') { day.prn.push(info.min); toast('✓ Gaviscon သောက်ကြောင်း မှတ်ပြီးပါပြီ', 'teal'); }
    else if (action === 'prn-remove') { day.prn.splice(+id, 1); }
    else if (action === 'reset-times') { state.settings = { ...DEFAULTS }; fillInputs(); afterTimeChange(); }
    else if (action === 'enable-notif') { enableNotifications(); return; }
    else if (action === 'install') { installApp(); return; }
    else if (action === 'sign-in') { signIn(); return; }
    else if (action === 'sign-out') { signOutUser(); return; }
    else if (action === 'reload') { location.reload(); return; }
    else if (action === 'open-drawer') { setDrawer(true); return; }
    else if (action === 'close-drawer') { setDrawer(false); return; }
    else if (action === 'view') { showView(id); return; }

    save(); render();
  }

  document.body.addEventListener('click', e => {
    const b = e.target.closest('[data-action]');
    if (b) onAction(b.dataset.action, b.dataset.id);
  });

  /* ---------- အချိန် ပြောင်းခြင်း ---------- */
  const FIELDS = ['wake', 'breakfast', 'lunch', 'dinner', 'bed'];
  // ရွေးချယ်နိုင်သော အချိန်အပိုင်းအခြား (မိနစ် ၃၀ ခြား) — ရိုက်ထည့်စရာ မလိုပါ
  const RANGES = { wake: [240, 840], breakfast: [300, 900], lunch: [600, 1080], dinner: [960, 1410], bed: [1200, 1680] };
  const toHHMM = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  function fillInputs() {
    FIELDS.forEach(f => {
      const el = $('#t-' + f), [from, to] = RANGES[f];
      const cur = Math.round(toMin(state.settings[f]) / 30) * 30 % 1440;
      const opts = [];
      for (let m = from; m <= to; m += 30) opts.push(m % 1440);
      if (!opts.includes(cur)) opts.unshift(cur);
      el.innerHTML = opts.map(m => `<option value="${toHHMM(m)}">${fmtTime(m)}</option>`).join('');
      el.value = state.settings[f] = toHHMM(cur);
    });
  }
  function afterTimeChange() {
    // အနာဂတ်သို့ ရွှေ့လိုက်သော အရာများအတွက် အသိပေးချက်ကို ပြန်ဖွင့်ပေးမည်
    const info = nowInfo(), day = getDay(info.key);
    buildSchedule(day).forEach(it => { if (it.time > info.min) { delete day.notified[it.id]; delete day.warned[it.id]; } });
    save(); render();
  }
  FIELDS.forEach(f => $('#t-' + f).addEventListener('change', e => {
    if (!e.target.value) { e.target.value = state.settings[f]; return; }
    state.settings[f] = e.target.value;
    afterTimeChange();
  }));

  /* ---------- အသိပေးချက်များ ---------- */
  let swReg = null;
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').then(r => { swReg = r; }).catch(() => {});
  }

  function renderNotifState() {
    const btn = $('#notifBtn'), txt = $('#notifStatus');
    if (!('Notification' in window)) {
      txt.textContent = 'ဤ browser တွင် အသိပေးချက် မရနိုင်ပါ — အက်ပ်ထဲတွင်သာ သတိပေးပါမည်။'; btn.classList.add('hidden');
    } else if (Notification.permission === 'granted') {
      txt.textContent = 'ဖွင့်ထားပြီး ✓ — ဤစာမျက်နှာကို ဖွင့်ထားစဉ် အချိန်ကျတိုင်း အသိပေးပါမည်။'; btn.classList.add('hidden');
    } else if (Notification.permission === 'denied') {
      txt.textContent = 'ပိတ်ထားသည် — browser ၏ site settings တွင် ပြန်ဖွင့်ပေးပါ။'; btn.classList.add('hidden');
    } else {
      txt.textContent = 'ဆေးသောက်ချိန်၊ အစာစားချိန် ရောက်တိုင်း အသိပေးရန် ဖွင့်ပါ။'; btn.classList.remove('hidden');
    }
    $('#notifNudge').classList.toggle('hidden', !('Notification' in window) || Notification.permission !== 'default');
  }
  async function enableNotifications() {
    if (!('Notification' in window)) return;
    const p = await Notification.requestPermission();
    if (p === 'granted') pushNotify('အသိပေးချက် ဖွင့်ပြီးပါပြီ', 'ဆေးသောက်ချိန် ရောက်တိုင်း ဤကဲ့သို့ အသိပေးပါမည်။', 'welcome');
    render();
  }
  function pushNotify(title, body, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const opts = { body, tag, lang: 'my', renotify: true };
    try {
      if (swReg && swReg.showNotification) swReg.showNotification(title, opts);
      else new Notification(title, opts);
    } catch (e) { /* အချို့ မိုဘိုင်း browser များတွင် မရနိုင် — toast ဖြင့်သာ ပြမည် */ }
  }
  function beep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext, ctx = new Ctx();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      o.start(); o.stop(ctx.currentTime + 0.6);
      o.onended = () => ctx.close();
    } catch (e) {}
  }
  function toast(text, tone = 'amber', ms = 3500) {
    const cls = { amber: 'bg-amber-500', teal: 'bg-teal-600', rose: 'bg-rose-600' }[tone];
    const el = document.createElement('div');
    el.className = `slide-in pointer-events-auto ${cls} text-white rounded-xl shadow-lg px-4 py-2.5 text-sm font-medium max-w-md w-full sm:w-auto`;
    el.textContent = text;
    $('#toasts').replaceChildren(el); // တစ်ကြိမ်လျှင် စာတန်းတစ်ခုသာ ပြမည်
    setTimeout(() => el.remove(), ms);
  }

  function checkReminders() {
    const info = nowInfo(), day = getDay(info.key), items = buildSchedule(day), now = info.min;
    let changed = false, ring = false;

    // အချိန်ရွှေ့သွား၍ အနာဂတ်သို့ ရောက်သွားသော အရာများအတွက် အသိပေးချက်ကို ပြန်ဖွင့်ပေးမည်
    items.forEach(it => {
      if (it.time > now && (day.notified[it.id] || day.warned[it.id]) && !day.doses[it.id]) { delete day.notified[it.id]; delete day.warned[it.id]; changed = true; }
    });

    // အချိန်ကျပြီ အသိပေးချက်
    items.forEach(it => {
      if (it.type === 'info' || day.notified[it.id]) return;
      if (statusOf(it, day, now) !== 'due' || now - it.time > NOTIFY_WINDOW) return;
      const title = it.type === 'meal' ? `${MEALS[it.id].icon} ${MEALS[it.id].name} စားချိန် ရောက်ပါပြီ` : `💊 ${MEDS[it.med].name} သောက်ချိန် ရောက်ပါပြီ`;
      const body = it.type === 'meal' ? `${fmtTime(it.time)} — အစာစားပြီးနောက် Myonal သောက်ရန် မမေ့ပါနှင့်။` : `${it.when} · ${MEDS[it.med].rule}`;
      pushNotify(title, body, it.id);
      toast(title, 'amber', 9000);
      day.notified[it.id] = true; changed = true; ring = true;
    });
    if (ring) beep();

    // လွတ်သွားသောဆေးများအတွက် ဆိုးကျိုး သတိပေး popup
    if (!modalOpen) {
      const missed = items.filter(it => it.type === 'dose' && statusOf(it, day, now) === 'missed' && !day.warned[it.id]);
      if (missed.length) {
        missed.forEach(it => { day.warned[it.id] = true; });
        changed = true;
        const meds = [...new Set(missed.map(it => it.med))].map(k => MEDS[k]);
        pushNotify('⚠️ ဆေးသောက်ရန် လွတ်နေပါသည်', meds.map(m => m.name).join('၊ ') + ' — ' + meds[0].consequence, 'missed');
        openModal({
          tone: 'rose', icon: '⚠️', title: 'ဆေးသောက်ရန် လွတ်နေပါသည်',
          body: `<p>အောက်ပါဆေးများကို သတ်မှတ်ချိန်တွင် မသောက်ရသေးပါ —</p>${meds.map(consequenceBox).join('')}
                 <p class="text-sm text-slate-600">သတိရသည်နှင့် သောက်နိုင်ပါသည်။ သို့သော် နောက်တစ်ကြိမ် သောက်ချိန်နှင့် နီးနေပါက <b>နှစ်ဆတိုး၍ မသောက်ပါနှင့်။</b> Clonazepam ကို အိပ်ရာဝင်ချိန်တွင်သာ သောက်ပါ။</p>`,
          actions: [{ label: 'နားလည်ပါပြီ — အချိန်ဇယားကို ကြည့်မည်', primary: true }]
        });
      }
    }
    if (changed) save();
  }

  /* ---------- အက်ပ်အဖြစ် ထည့်သွင်းခြင်း (PWA) ---------- */
  let installEvent = null;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); installEvent = e;
    $('#installRow').classList.remove('hidden');
  });
  window.addEventListener('appinstalled', () => { installEvent = null; $('#installRow').classList.add('hidden'); });
  // iPhone/iPad တွင် ထည့်သွင်းခလုတ် မပေါ်နိုင်၍ လုပ်နည်းကိုသာ ပြမည်
  if (!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
    $('#installHint').textContent = 'Safari ၏ Share (မျှဝေရန်) ခလုတ်ကို နှိပ်ပြီး "Add to Home Screen" ကို ရွေးပါ။';
    $('#installBtn').classList.add('hidden');
    $('#installRow').classList.remove('hidden');
  }
  async function installApp() {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    $('#installRow').classList.add('hidden');
  }

  /* ---------- အကောင့်နှင့် Sync (Firebase) ----------
     firebase-config.js ထဲတွင် config ထည့်ထားမှသာ အလုပ်လုပ်သည်။ မထည့်ထားလျှင် ဤစက်ထဲတွင်သာ သိမ်းမည်။
     Cloud တွင် users/{uid} (အချိန်ဆက်တင်) နှင့် users/{uid}/days/{ရက်စွဲ} (နေ့စဉ်မှတ်တမ်း) အဖြစ် သိမ်းသည်။
     အသိပေးပြီး/မပြီး (notified, warned) ကို စက်တစ်လုံးချင်းစီတွင်သာ ထားသည်။ */
  const FB_VER = '10.14.1';
  const DOSE_IDS = ['miracid', 'domp', 'myonal1', 'myonal2', 'myonal3', 'clona'];
  const MEAL_IDS = ['breakfast', 'lunch', 'dinner'];
  const cloud = { ready: false, user: null, error: null, unsub: [], synced: { settings: null, days: {} } };
  // key အစီအစဉ် မတူလည်း တန်ဖိုးတူလျှင် တူသည်ဟု ယူဆရန်
  const canon = v => JSON.stringify(v == null ? null : v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.keys(x).sort().reduce((o, key) => { o[key] = x[key]; return o; }, {}) : x);
  const same = (a, b) => canon(a) === canon(b);
  const copy = v => JSON.parse(JSON.stringify(v));

  // ဤစက်တွင် ပြောင်းလဲသွားသော အကွက်များကိုသာ cloud သို့ ပို့မည် (အခြားဖုန်း၏ မှတ်တမ်းကို မဖျက်မိစေရန်)
  function cloudPush() {
    if (!cloud.ready) return;
    const { fs, db, user } = cloud;
    if (!same(state.settings, cloud.synced.settings)) {
      cloud.synced.settings = copy(state.settings);
      fs.setDoc(fs.doc(db, 'users', user.uid), { settings: state.settings, updatedAt: fs.serverTimestamp() }, { merge: true }).catch(cloudError);
    }
    Object.keys(state.days).forEach(key => {
      const d = state.days[key], was = cloud.synced.days[key] || { doses: {}, meals: {}, prn: [] };
      const out = {};
      DOSE_IDS.forEach(id => { if (!same(d.doses[id], was.doses[id])) (out.doses = out.doses || {})[id] = d.doses[id] || fs.deleteField(); });
      MEAL_IDS.forEach(id => { if (!same(d.meals[id], was.meals[id])) (out.meals = out.meals || {})[id] = d.meals[id] != null ? d.meals[id] : fs.deleteField(); });
      if (!same(d.prn, was.prn)) out.prn = d.prn;
      if (!Object.keys(out).length) return;
      cloud.synced.days[key] = copy({ doses: d.doses, meals: d.meals, prn: d.prn });
      fs.setDoc(fs.doc(db, 'users', user.uid, 'days', key), out, { merge: true }).catch(cloudError);
    });
  }

  function applyRemoteDay(key, data, first) {
    const r = { doses: data.doses || {}, meals: data.meals || {}, prn: data.prn || [] };
    const d = getDay(key);
    if (first) {
      // ပထမဆုံးအကြိမ် ချိတ်ချိန် — ဤစက်ထဲတွင်သာ ရှိသော မှတ်တမ်းကို ထိန်းထားပြီး၊ တူညီသောအကွက်တွင် cloud ကို ဦးစားပေးမည်
      d.doses = { ...d.doses, ...r.doses }; d.meals = { ...d.meals, ...r.meals };
      if (r.prn.length || !d.prn.length) d.prn = r.prn;
    } else { d.doses = r.doses; d.meals = r.meals; d.prn = r.prn; }
    cloud.synced.days[key] = copy(r);
  }

  /* ---------- Login တံခါး ----------
     Login မဝင်မချင်း app ၏ မည်သည့်အချက်အလက်ကိုမျှ မပြ၊ အသိပေးချက်လည်း မပို့။
     မှတ်တမ်းအစစ်ကို ကာကွယ်ပေးသည်မှာ Firestore security rules ဖြစ်ပြီး ဤတံခါးသည် မျက်နှာပြင်ကို ဖုံးပေးခြင်းသာ ဖြစ်သည်။ */
  let unlocked = false;
  const GATE_TEXT = {
    checking: 'စစ်ဆေးနေပါသည်…',
    signin: 'ဆက်လက်အသုံးပြုရန် သင့် Google account ဖြင့် ဝင်ပါ။',
    loading: 'မှတ်တမ်းများ ယူနေပါသည်…',
    error: 'ချိတ်ဆက်၍ မရပါ — အင်တာနက်ကို စစ်ပြီး ပြန်ကြိုးစားပါ။'
  };
  function gate(mode, err) {
    unlocked = false;
    $('#app').classList.add('hidden'); $('#gate').classList.remove('hidden');
    $('#gateStatus').textContent = GATE_TEXT[mode];
    $('#gateBtn').classList.toggle('hidden', mode !== 'signin');
    $('#gateRetry').classList.toggle('hidden', mode !== 'error');
    $('#gateErr').textContent = err ? `အမှား — ${err}` : '';
  }
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    $('#gate').classList.add('hidden'); $('#app').classList.remove('hidden');
    fillInputs(); tick();
  }
  // ဤစက်ထဲတွင် သိမ်းထားသော မှတ်တမ်းအားလုံးကို ဖျက်မည် (ထွက်လိုက်ချိန်၊ အခြား account ဝင်လာချိန်)
  function wipeLocal() {
    state = { v: 2, uid: null, settings: { ...DEFAULTS }, days: {} };
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  }
  async function signOutUser() {
    const { fs, db, authM, auth } = cloud;
    cloud.unsub.forEach(f => f()); cloud.unsub = []; cloud.ready = false;
    wipeLocal();
    try { await authM.signOut(auth); } catch (e) {}
    try { await fs.terminate(db); await fs.clearIndexedDbPersistence(db); } catch (e) {}
    location.reload();
  }

  function onUser(user) {
    cloud.unsub.forEach(f => f()); cloud.unsub = [];
    cloud.ready = false; cloud.user = user; cloud.synced = { settings: null, days: {} };
    if (!user) {
      if (state.uid) wipeLocal();
      gate('signin', cloud.error);
      return;
    }
    cloud.error = null;
    if (state.uid && state.uid !== user.uid) wipeLocal(); // အခြား account ၏ မှတ်တမ်းနှင့် မရောစေရန်
    state.uid = user.uid; saveLocal();
    renderAccount();
    if (!unlocked) {
      gate('loading');
      // cloud မှ အဖြေ ကြာနေလျှင် (အင်တာနက်နှေးချိန်) ဤစက်ထဲရှိ မှတ်တမ်းဖြင့် ဆက်သွားမည်
      setTimeout(() => { if (cloud.user === user) unlock(); }, 8000);
    }
    const { fs, db } = cloud;
    let gotSettings = false, gotDays = false, firstDays = true;
    const done = () => {
      if (!gotSettings || !gotDays) return;
      cloud.ready = true;
      saveLocal(); cloudPush();
      if (unlocked) render(); else unlock();
      renderAccount();
    };
    cloud.unsub.push(fs.onSnapshot(fs.doc(db, 'users', user.uid), snap => {
      const r = snap.data();
      if (r && r.settings) {
        cloud.synced.settings = copy(r.settings);
        const merged = { ...DEFAULTS, ...r.settings };
        if (!same(state.settings, merged)) { state.settings = merged; fillInputs(); }
      }
      gotSettings = true; done();
    }, cloudError));
    const cutoff = dateKey(new Date(Date.now() - 31 * 864e5));
    const q = fs.query(fs.collection(db, 'users', user.uid, 'days'), fs.where(fs.documentId(), '>=', cutoff));
    cloud.unsub.push(fs.onSnapshot(q, snap => {
      snap.docChanges().forEach(ch => { if (ch.type !== 'removed') applyRemoteDay(ch.doc.id, ch.doc.data(), firstDays); });
      firstDays = false; gotDays = true; done();
    }, cloudError));
  }

  async function signIn() {
    const { authM, auth } = cloud;
    if (!auth) return;
    const provider = new authM.GoogleAuthProvider();
    cloud.error = null; $('#gateErr').textContent = '';
    try { await authM.signInWithPopup(auth, provider); }
    catch (e) {
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) authM.signInWithRedirect(auth, provider).catch(cloudError);
      else if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(e.code)) cloudError(e);
    }
  }
  function cloudError(e) {
    console.warn('sync:', e); cloud.error = (e && (e.code || e.message)) || 'error';
    if (!unlocked) $('#gateErr').textContent = `အမှား — ${cloud.error}`;
    renderAccount();
  }

  function renderAccount() {
    const body = $('#accountBody'), chip = $('#accountChip');
    const btn = 'rounded-xl font-medium px-4 py-2.5 text-sm';
    const err = cloud.error ? `<p class="mt-2 text-sm text-rose-700">⚠️ ချိတ်ဆက်မှု အမှား — <span id="accountErr"></span></p>` : '';
    if (!cloud.auth) {
      chip.textContent = ''; body.innerHTML = `<p class="text-sm text-slate-500">ချိတ်ဆက်နေပါသည်…</p>${err}`;
    } else if (!cloud.user) {
      chip.textContent = '· မဝင်ရသေးပါ';
      body.innerHTML = `<p class="text-sm text-slate-600">Google account ဖြင့် ဝင်ထားလျှင် ထို account ဖြင့် ဝင်ထားသော ဖုန်း/ကွန်ပျူတာတိုင်းတွင် အချိန်ဆက်တင်နှင့် မှတ်တမ်းများ တူညီနေပါမည်။</p>
        <button data-action="sign-in" class="${btn} mt-3 bg-teal-600 hover:bg-teal-700 text-white">Google ဖြင့် ဝင်မည်</button>${err}`;
    } else {
      chip.textContent = cloud.ready ? '· ✓ sync ဖြစ်နေသည်' : '· ချိတ်ဆက်နေသည်…';
      body.innerHTML = `<p class="text-sm text-slate-600"><span id="accountEmail" class="font-semibold text-slate-800"></span> ဖြင့် ဝင်ထားပါသည်။ မှတ်တမ်းများကို ဤ account အောက်တွင် သိမ်းပြီး စက်တိုင်းတွင် sync လုပ်ပေးနေပါသည်။</p>
        <button data-action="sign-out" class="${btn} mt-3 bg-slate-100 hover:bg-slate-200 text-slate-700">ထွက်မည်</button>${err}`;
      $('#accountEmail').textContent = cloud.user.email || cloud.user.displayName || '';
    }
    if (cloud.error) $('#accountErr').textContent = cloud.error;
  }

  async function cloudInit() {
    const cfg = window.FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey) { unlock(); return; } // config မရှိလျှင် login မလိုဘဲ ဤစက်ထဲတွင်သာ သုံးမည်
    gate('checking');
    $('#accountBox').classList.remove('hidden');
    renderAccount();
    try {
      const base = `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-`;
      const [appM, authM, fs] = await Promise.all([import(base + 'app.js'), import(base + 'auth.js'), import(base + 'firestore.js')]);
      const app = appM.initializeApp(cfg);
      cloud.fs = fs; cloud.authM = authM;
      // offline ဖြစ်နေစဉ် ပြောင်းလဲမှုများကို သိမ်းထားပြီး အင်တာနက်ပြန်ရမှ ပို့ပေးရန်
      try { cloud.db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) }); }
      catch (e) { cloud.db = fs.getFirestore(app); }
      cloud.auth = authM.getAuth(app);
      authM.getRedirectResult(cloud.auth).catch(cloudError);
      authM.onAuthStateChanged(cloud.auth, onUser);
    } catch (e) { cloudError(e); gate('error', cloud.error); }
  }

  /* ---------- စတင်ခြင်း ---------- */
  function tick() { if (!unlocked) return; render(); checkReminders(); }
  showView('home');
  setInterval(tick, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  cloudInit();
})();
