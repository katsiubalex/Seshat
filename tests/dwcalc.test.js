// Водоподготовка: классы вод, схемы СП 31 (прил. Б), достижимое качество (табл. 11, Б.7) и расчёт сооружений.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/dwcalc.js');
const preset = id => { const p = D.PRESETS.find(x => x.id === id); return { src: p.src, q: p.q, c: { ...p.c } }; };
const run = (inp, scheme) => D.simulate({ ...inp, scheme: scheme || D.classify(inp).scheme });
const near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} ≠ ${b} ± ${t}`);

test('классы поверхностных вод по табл. Б.1', () => {
  const base = { turb: 10, color: 10, po: 6, tds: 300, hard: 3, phyto: 100 };
  assert.equal(D.surfaceClass({ ...base, color: 120, turb: 8 }), 'A1');
  assert.equal(D.surfaceClass({ ...base, color: 120, turb: 8, po: 14 }), 'A3');
  assert.equal(D.surfaceClass({ ...base, color: 300, turb: 20 }), 'A2');
  assert.equal(D.surfaceClass({ ...base, color: 60, turb: 80 }), 'B1');
  assert.equal(D.surfaceClass({ ...base, color: 15, turb: 600 }), 'C1');
  assert.equal(D.surfaceClass({ ...base, color: 15, turb: 2000, po: 5 }), 'C2');
  assert.equal(D.surfaceClass({ ...base, color: 15, turb: 2000, po: 12 }), 'C3');
  assert.equal(D.surfaceClass({ ...base, color: 15, turb: 20, phyto: 5000 }), 'D1');
  assert.equal(D.surfaceClass({ ...base, tds: 1500, hard: 12 }), 'E');
});

test('рекомендуемые схемы: табл. Б.4 по классу, табл. Б.6 по подклассу, цепочка из кодов табл. Б.3', () => {
  const a1 = D.classify(preset('colored-a1'));
  assert.equal(a1.id, 'A1'); assert.deepEqual(a1.sub, [6]); assert.equal(a1.code, 'T1'); // железо 0,8 > 0,3 — подкласс 6, для А1 → Т1[К(Ф)]
  assert.deepEqual(a1.scheme, ['prechlor', 'coag', 'vsettle', 'rfilter', 'uv', 'chlor']); // Хл → К(Ф) → ОтР → СкФР → УФ → Хл
  const big = D.classify({ ...preset('colored-a1'), q: 60000 });
  assert.ok(big.scheme.includes('hsettle'), 'свыше 30 000 м³/сут — горизонтальные отстойники (табл. 11, п. 2)');
  const c1 = D.classify(preset('turbid-c1')); assert.equal(c1.code, 'T9'); assert.ok(c1.scheme.includes('clarifier'));
  const clean = { ...preset('river-b1') }; clean.c.fe = 0.2; assert.equal(D.classify(clean).code, 'T7'); // без подкласса — основная схема класса В1
  for (const [code, chain] of Object.entries(D.TECH)) for (const k of chain.split(' ')) assert.ok(['ОтР'].includes(k) || D.techScheme(code, 1000).length, code);
});

test('подземные воды: подкласс по табл. Б.7 и степень очистки', () => {
  const fe = D.classify(preset('ground-fe'));
  assert.equal(fe.id, '2.1'); assert.equal(fe.scheme[0], 'aerdeep', 'сероводород 0,2 мг/л — глубокая аэрация (п. 9.164)');
  const fmf = D.classify(preset('ground-femnf'));
  assert.equal(fmf.id, '3.3'); assert.ok(fmf.scheme.includes('alumina'));
  const r = run(preset('ground-femnf'));
  assert.ok(r.check.every(x => x.ok), r.check.filter(x => !x.ok).map(x => x.k).join());
  assert.ok(r.out.fe <= 0.1 && r.out.mn <= 0.05, 'Б.7, подкласс 3.3: Fe < 0,1, Mn < 0,05');
  near(r.out.f, 1.0, 0.5, 'фтор 0,7–1,5 мг/л');
  const hard = D.classify(preset('ground-hard'));
  assert.ok(hard.scheme.includes('ro') && hard.scheme.indexOf('uf') === hard.scheme.indexOf('ro') - 1, 'обессоливание с ультрафильтрацией (схема Т18)');
});

test('упрощённая аэрация: условия п. 9.148', () => {
  const ok = { src: 'ground', q: 1000, c: { ...preset('ground-fe').c, h2s: 0 } };
  const r1 = run(ok, ['aersimple', 'gfilter', 'chlor']);
  assert.ok(!r1.warns.some(w => /не применима/.test(w.text))); assert.ok(r1.out.fe <= 0.3);
  const lowFe2 = { ...ok, c: { ...ok.c, fe2: 50 } }, r2 = run(lowFe2, ['aersimple', 'gfilter', 'chlor']);
  assert.ok(r2.warns.some(w => /двухвалентного железа меньше 70/.test(w.text)));
  const acid = { ...ok, c: { ...ok.c, ph: 6.5, alk: 1 } }, r3 = run(acid, ['aersimple', 'gfilter', 'chlor']);
  assert.ok(r3.warns.some(w => /pH ниже 6,8/.test(w.text) && /щёлочность/.test(w.text)));
});

test('достижимое качество по табл. 11: отстаивание до 15 мг/л и 40°, фильтры — 1,5 мг/л и 20°', () => {
  const inp = preset('turbid-c1');
  const r = run(inp, ['coag', 'clarifier', 'rfilter', 'chlor']);
  const after = id => r.steps[r.steps.findIndex(s => s.id === id)].q;
  assert.equal(after('clarifier').turb, 15); assert.ok(after('clarifier').color <= 40);
  assert.equal(after('rfilter').turb, 1.5); assert.ok(after('rfilter').color <= 20);
  assert.ok(r.micro, 'осветление + фильтрование + обеззараживание');
  // без коагулянта отстойник не даёт табличного результата
  const raw = run(inp, ['vsettle', 'rfilter', 'chlor']);
  assert.ok(raw.out.turb > 1.5); assert.ok(raw.warns.some(w => /коагулированную воду/.test(w.text)));
});

test('контактные осветлители — только до 70 мг/л и 70°; реагентное фильтрование без отстаивания — до 200', () => {
  const r = run(preset('river-b1'), ['coag', 'cclar', 'chlor']);
  assert.ok(r.warns.some(w => w.level === 'bad' && /до 70 мг\/л/.test(w.text))); assert.ok(r.out.turb > 1.5);
  const lo = preset('colored-a1'); lo.c.color = 50; lo.c.turb = 20;
  const ok = run(lo, ['alkali', 'coag', 'cclar', 'chlor']);
  assert.equal(ok.out.turb, 1.5); assert.equal(ok.out.color, 20);
  assert.ok(!ok.warns.some(w => /до 70 мг\/л/.test(w.text)));
  const turbid = run(preset('turbid-c1'), ['coag', 'rfilter', 'chlor']);
  assert.ok(turbid.warns.some(w => /до 200 мг\/л/.test(w.text)));
});

test('сквозные проверки схемы: нет обеззараживания, нет фильтров после угля и коагулянта, УФ без хлора, умягчение без стабилизации', () => {
  const s = preset('river-b1');
  assert.ok(run(s, ['coag', 'vsettle', 'rfilter']).warns.some(w => /Нет обеззараживания/.test(w.text)));
  assert.ok(run(s, ['coag', 'vsettle', 'chlor']).warns.some(w => /остаточный алюминий/.test(w.text)));
  assert.ok(run(s, ['coag', 'vsettle', 'rfilter', 'pac', 'chlor']).warns.some(w => /порошкового угля/.test(w.text)));
  assert.ok(run(s, ['coag', 'vsettle', 'rfilter', 'uv']).warns.some(w => /остаточного дезинфектанта/.test(w.text)));
  assert.ok(run(preset('ground-hard'), ['uf', 'ro', 'chlor']).warns.some(w => /стабильность/.test(w.text)));
  const g = preset('ground-fe');
  assert.ok(run(g, ['aerdeep', 'gfilter']).warns.some(w => /50 м³\/сут/.test(w.text)), 'п. 9.113 — подземные воды');
});

test('подщелачивание по формуле (5) п. 9.16: Дщ = Кщ(Дк/eк − Щ₀) + 1', () => {
  const inp = { ...preset('colored-a1'), coagDose: 60 }; inp.c.alk = 0.5;
  const r = run(inp, ['coag', 'vsettle', 'rfilter', 'chlor']);
  const w = r.warns.find(x => /подщелачивание/.test(x.text)); assert.ok(w);
  near(28 * (60 / 57 - 0.5) + 1, 16.47, 0.01, 'доза извести'); assert.match(w.text, /16,5/);
  assert.ok(!run({ ...inp, coagDose: 20 }, ['coag', 'vsettle', 'rfilter', 'chlor']).warns.some(x => /подщелачивание/.test(x.text)));
});

test('расчёт сооружений: собственные нужды, вертикальные отстойники, фильтры, хлорное хозяйство', () => {
  const inp = { ...preset('colored-a1'), q: 4000 }; inp.scheme = ['coag', 'vsettle', 'rfilter', 'chlor'];
  const rows = D.sizing(inp, D.simulate(inp)), get = (t, l) => rows.find(g => g.t === t).items.find(i => i[0].startsWith(l));
  assert.match(get('Станция', 'Расчётный расход')[1], /^4\s160 м³\/сут/); // +4 % собственных нужд (п. 9.6)
  // формула (7): F = q·βоб/(3,6·vр·Nр); q = 173,3 м³/ч, βоб = 1,4, u0 = 0,35 мм/с (маломутные цветные, табл. 12), N = 2
  near(173.33 * 1.4 / (3.6 * 0.35 * 2), 96.3, 0.1, 'площадь отстойника'); assert.match(get('Вертикальные отстойники', 'Площадь зоны')[1], /^96,3 м²/);
  const f = rows.find(g => g.t === 'Фильтры'), n = +f.items.find(i => i[0] === 'Количество фильтров')[1].split(' ')[0];
  assert.ok(n >= 4, 'не менее четырёх фильтров при Q > 1600 м³/сут (п. 9.82)');
  assert.ok(!f.items.find(i => i[0].startsWith('Форсированный'))[3], 'форсированная скорость не превышает табл. 15');
  assert.match(get('Обеззараживание', 'Хлорное хозяйство')[1], /гипохлорит/); // 3 мг/л × 4160 м³ = 12,5 кг/сут < 40 (п. 9.116)
});

test('каждое сооружение описано и имеет ссылку на документ; ориентиры помечены', () => {
  const docs = new Set(require('../js/docs.js').DOCS.map(d => d.id));
  for (const u of D.UNITS) {
    assert.ok(u.n && u.d && u.how && u.params.length && u.refs.length, u.id);
    assert.ok(u.refs.every(x => docs.has(x.doc)), u.id);
    assert.ok(D.STAGES.some(s => s.id === u.st), u.id);
    (u.est || []).forEach(k => assert.ok(D.EST[k], u.id + ': нет пояснения ориентира ' + k));
  }
  for (const p of D.PARAMS.filter(x => x.norm)) assert.ok(docs.has(p.norm.ref.doc), p.k);
});
