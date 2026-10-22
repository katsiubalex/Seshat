const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const Art = require('../js/art.js');

const IDS = ['tlaloc', 'hapi', 'yu', 'enki', 'anahita', 'juturna', 'cloacina', 'tlazolteotl'];
const chapters = id => { const s = fs.readFileSync(__dirname + '/../js/lore.js', 'utf8'); const b = s.slice(s.indexOf(`  ${id}: {`)); return b.slice(0, b.indexOf('sources:')).split(/\{ k: '/).length - 1; };

test('у каждого божества есть символ и иллюстрация к каждой главе истории', () => {
  for (const id of IDS) {
    assert.ok(Art.has.symbol(id), id);
    assert.strictEqual(Art.has.lore(id), chapters(id), id);
    for (let i = 0; i < Art.has.lore(id); i++) assert.match(Art.lore(id, i), /^<svg[^>]*>.+<\/svg>$/s);
  }
});

test('эскиз конструктора есть у каждого модуля в разработке и нет у готового', () => {
  for (const id of IDS) assert.strictEqual(Art.has.sketch(id), id !== 'tlazolteotl', id);
});

test('боковое меню всех модулей: плашка ведёт в конструктор, без «о богине», пункт «Конструктор» есть', () => {
  for (const id of IDS) {
    const h = fs.readFileSync(`${__dirname}/../${id}/index.html`, 'utf8');
    assert.match(h, /class="nav-module[^"]*" href="#constructor" data-view="constructor"/, id);
    assert.doesNotMatch(h, /о (богине|боге|легенде) →/, id);
    assert.match(h, /class="nav-link" href="#constructor"/, id);
    assert.match(h, /id="view-constructor"/, id);
    assert.match(h, /js\/art\.js/, id);
  }
});
