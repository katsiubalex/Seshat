const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const Art = require('../js/art.js');

const My = require('../js/myths.js');
const IDS = ['tlaloc', 'hapi', 'yu', 'enki', 'anahita', 'juturna', 'cloacina', 'tlazolteotl'];
const chapters = id => My.BY[id].chapters.length;

test('у каждого мифа о воде есть символ и иллюстрация к каждой главе', () => {
  for (const id of My.ORDER) {
    assert.ok(Art.has.symbol(id), id);
    assert.strictEqual(Art.has.lore(id), chapters(id), id);
    for (let i = 0; i < Art.has.lore(id); i++) assert.match(Art.lore(id, i), /^<svg[^>]*>.+<\/svg>$/s);
  }
});

test('эскиз конструктора есть у каждого модуля в разработке и нет у готового', () => {
  for (const id of IDS) assert.strictEqual(Art.has.sketch(id), id !== 'tlazolteotl', id);
});

test('боковое меню всех модулей: плашка ведёт в конструктор, без «о богине», пункт «Конструктор» есть, истории божества нет', () => {
  for (const id of IDS) {
    const h = fs.readFileSync(`${__dirname}/../${id}/index.html`, 'utf8');
    assert.doesNotMatch(h, /href="#lore"|id="view-lore"|js\/lore\.js/, id); // мифы — в «Гуманитарных аспектах»
    assert.match(h, /class="nav-module[^"]*" href="#constructor" data-view="constructor"/, id);
    assert.doesNotMatch(h, /о (богине|боге|легенде) →/, id);
    assert.match(h, /class="nav-link" href="#constructor"/, id);
    assert.match(h, /id="view-constructor"/, id);
    assert.match(h, /js\/art\.js/, id);
  }
});

test('«Гуманитарные аспекты»: мифы о воде с разделом и подключёнными рисунками', () => {
  const h = fs.readFileSync(`${__dirname}/../humanities/index.html`, 'utf8');
  for (const r of [/data-page="humanities"/, /href="#lore" data-view="lore"/, /id="view-lore"/, /js\/myths\.js/, /js\/art\.js/, /js\/lore\.js/]) assert.match(h, r);
});
