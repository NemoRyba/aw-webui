import { createPinia, setActivePinia } from 'pinia';

import { classifyEvents, cleanCategory, matchString } from '~/util/classes';
import { useCategoryStore } from '~/stores/categories';

// Multi-field category rules: a rule's `conditions` are AND-ed onto its
// primary regex, and a category may carry `extra_rules` (OR-ed) so its main
// rule stays untouched. Motivating case: ApplicationFrameHost.exe hosts many
// unrelated programs, so app + title together must decide the category.

const FRAME_HOST = 'ApplicationFrameHost.exe';

function event(data) {
  return { data: { ...data } };
}

const imageRule = {
  type: 'regex',
  regex: 'ApplicationFrameHost\\.exe',
  select_keys: ['app'],
  conditions: [{ field: 'title', regex: 'Ausschneiden' }],
};

describe('rule conditions', () => {
  it('restrict the primary match to events where every condition holds', () => {
    const categories = [{ name: ['Work', 'Image'], rule: imageRule }];
    const [snip, game] = classifyEvents(
      [
        event({ app: FRAME_HOST, title: 'Ausschneiden und skizzieren' }),
        event({ app: FRAME_HOST, title: 'Solitaire' }),
      ],
      categories
    );
    expect(snip.data.$category).toEqual(['Work', 'Image']);
    expect(game.data.$category).toEqual(['Uncategorized']);
  });

  it('fail closed on malformed conditions and missing fields', () => {
    const categories = [
      {
        name: ['Work'],
        rule: { type: 'regex', regex: 'frame', conditions: [{ field: 'title', regex: '' }] },
      },
    ];
    const [e] = classifyEvents([event({ app: 'frame', title: 'Paint' })], categories);
    expect(e.data.$category).toEqual(['Uncategorized']);

    const [noTitle] = classifyEvents([event({ app: FRAME_HOST })], [
      { name: ['Work', 'Image'], rule: imageRule },
    ]);
    expect(noTitle.data.$category).toEqual(['Uncategorized']);
  });

  it('let the more specific rule win a same-depth tie in either order', () => {
    const broad = {
      name: ['Work', 'Image'],
      rule: { type: 'regex', regex: 'ApplicationFrameHost\\.exe', select_keys: ['app'] },
    };
    const specific = {
      name: ['Media', 'Games'],
      rule: {
        type: 'regex',
        regex: 'ApplicationFrameHost\\.exe',
        select_keys: ['app'],
        conditions: [{ field: 'title', regex: 'Solitaire' }],
      },
    };
    for (const categories of [
      [broad, specific],
      [specific, broad],
    ]) {
      const [e] = classifyEvents([event({ app: FRAME_HOST, title: 'Solitaire' })], categories);
      expect(e.data.$category).toEqual(['Media', 'Games']);
    }
  });
});

describe('extra rules', () => {
  it('route events into the category without touching its main rule', () => {
    const categories = [
      {
        name: ['Work', 'Image'],
        rule: { type: 'regex', regex: 'GIMP|Inkscape' },
        extra_rules: [imageRule],
      },
    ];
    const [byMain, byExtra, neither] = classifyEvents(
      [
        event({ app: 'GIMP', title: 'drawing.xcf' }),
        event({ app: FRAME_HOST, title: 'Ausschneiden und skizzieren' }),
        event({ app: FRAME_HOST, title: 'Solitaire' }),
      ],
      categories
    );
    expect(byMain.data.$category).toEqual(['Work', 'Image']);
    expect(byExtra.data.$category).toEqual(['Work', 'Image']);
    expect(neither.data.$category).toEqual(['Uncategorized']);
  });

  it('are flattened into repeated (name, rule) entries for the query', () => {
    setActivePinia(createPinia());
    const store = useCategoryStore();
    store.load([
      {
        id: 0,
        name: ['Work', 'Image'],
        rule: { type: 'regex', regex: 'GIMP' },
        extra_rules: [imageRule],
      },
      { id: 1, name: ['Media'], rule: { type: 'regex', regex: 'VLC' } },
    ]);
    const entries = store.classes_for_query;
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual([['Work', 'Image'], { type: 'regex', regex: 'GIMP' }]);
    expect(entries[1][0]).toEqual(['Work', 'Image']);
    expect(entries[1][1].conditions).toHaveLength(1);
    expect(entries[2][0]).toEqual(['Media']);
  });

  it('addExtraRuleToClass appends without touching the main rule', () => {
    setActivePinia(createPinia());
    const store = useCategoryStore();
    store.load([{ id: 0, name: ['Work', 'Image'], rule: { type: 'regex', regex: 'GIMP' } }]);
    store.addExtraRuleToClass(['Work', 'Image'], imageRule);
    const cat = store.classes[0];
    expect(cat.rule).toEqual({ type: 'regex', regex: 'GIMP' });
    expect(cat.extra_rules).toEqual([imageRule]);
    expect(store.classes_unsaved_changes).toBe(true);
    expect(() => store.addExtraRuleToClass(['Nope'], imageRule)).toThrow();
  });
});

describe('cleanCategory', () => {
  it('drops unsatisfiable conditions and empty extra rules', () => {
    const cleaned = cleanCategory({
      name: ['Work'],
      rule: {
        type: 'regex',
        regex: 'x',
        conditions: [{ field: '', regex: 'y' }, { field: 'title', regex: '' }],
      },
      extra_rules: [
        { type: 'regex', regex: '', conditions: [] },
        { type: 'regex', regex: 'keep', conditions: [{ field: 'title', regex: 'k' }] },
      ],
    });
    expect(cleaned.rule.conditions).toBeUndefined();
    expect(cleaned.extra_rules).toHaveLength(1);
    expect(cleaned.extra_rules[0].regex).toBe('keep');
  });

  it('leaves plain categories untouched', () => {
    const cleaned = cleanCategory({ name: ['Work'], rule: { type: 'regex', regex: 'x' } });
    expect(cleaned.rule).toEqual({ type: 'regex', regex: 'x' });
    expect(cleaned.extra_rules).toBeUndefined();
  });
});

describe('matchString', () => {
  it('skips conditioned rules - a bare string has no fields to check', () => {
    const categories = [
      { name: ['Work', 'Image'], rule: imageRule },
      { name: ['Media'], rule: { type: 'regex', regex: 'VLC' } },
    ];
    expect(matchString(FRAME_HOST, categories)).toBeNull();
    expect(matchString('VLC', categories).name).toEqual(['Media']);
  });
});
