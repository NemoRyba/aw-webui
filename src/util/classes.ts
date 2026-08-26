import _ from 'lodash';
import { IEvent } from './interfaces';
import { useSettingsStore } from '~/stores/settings';

const level_sep = '>';
const CLASSIFY_KEYS = ['app', 'title'];
const UNCATEGORIZED = ['Uncategorized'];

// One additional field check on a rule. Conditions are AND-ed onto the
// rule's primary regex, so app + title together can decide a category -
// needed for host processes like ApplicationFrameHost.exe that front many
// unrelated programs.
export interface RuleCondition {
  field: string;
  regex: string;
  ignore_case?: boolean;
}

export interface Rule {
  type: 'regex' | 'none';
  regex?: string;
  ignore_case?: boolean;
  select_keys?: string[];
  conditions?: RuleCondition[];
}

export interface Category {
  id?: number;
  name: string[];
  name_pretty?: string;
  subname?: string;
  rule: Rule;
  // Additional independent rules (OR-ed with `rule`). Lets a category keep
  // its existing broad rule untouched while conditioned rules route more
  // events into it - "leave the category as it is, add an app+title rule".
  extra_rules?: Rule[];
  data?: Record<string, any>;
  depth?: number;
  parent?: string[];
  children?: Category[];
}

// Every rule of a category, main first. The query engine accepts repeated
// (name, rule) entries, so callers can flatten with this.
export function categoryRules(cat: Category): Rule[] {
  return [cat.rule, ...(cat.extra_rules || [])].filter(r => r && r.type === 'regex');
}

function conditionsMatch(rule: Rule, data: Record<string, any>): boolean {
  for (const condition of rule.conditions || []) {
    // A malformed condition fails closed - it must not widen the rule.
    if (!condition.field || !condition.regex) {
      return false;
    }
    const value = data[condition.field];
    if (typeof value !== 'string') {
      return false;
    }
    const ignoreCase =
      condition.ignore_case === undefined ? rule.ignore_case : condition.ignore_case;
    if (!RegExp(condition.regex, ignoreCase ? 'i' : '').test(value)) {
      return false;
    }
  }
  return true;
}

const COLOR_UNCAT = '#CCC';

// The default categories
// Should be run through createMissingParents before being used in most cases.
export const defaultCategories: Category[] = [
  {
    name: ['Work'],
    rule: { type: 'regex', regex: 'Google Docs|libreoffice|ReText' },
    data: { color: '#0F0', score: 10 },
  },
  {
    name: ['Work', 'Programming'],
    rule: {
      type: 'regex',
      regex: 'GitHub|Stack Overflow|BitBucket|Gitlab|vim|Spyder|kate|Ghidra|Scite',
    },
  },
  {
    name: ['Work', 'Programming', 'ActivityWatch'],
    rule: { type: 'regex', regex: 'ActivityWatch|aw-', ignore_case: true },
  },
  { name: ['Work', 'Image'], rule: { type: 'regex', regex: 'GIMP|Inkscape' } },
  { name: ['Work', 'Video'], rule: { type: 'regex', regex: 'Kdenlive' } },
  { name: ['Work', 'Audio'], rule: { type: 'regex', regex: 'Audacity' } },
  { name: ['Work', '3D'], rule: { type: 'regex', regex: 'Blender' } },
  {
    name: ['Media'],
    rule: { type: 'none' },
    data: { color: '#F33' },
  },
  {
    name: ['Media', 'Games'],
    rule: { type: 'regex', regex: 'Minecraft|RimWorld' },
    data: { color: '#F80' },
  },
  {
    name: ['Media', 'Video'],
    rule: { type: 'regex', regex: 'YouTube|Plex|VLC' },
    data: { color: '#F33' },
  },
  {
    name: ['Media', 'Social Media'],
    rule: {
      type: 'regex',
      regex: 'reddit|Facebook|Twitter|Instagram|devRant',
      ignore_case: true,
    },
    data: { color: '#FCC400' },
  },
  {
    name: ['Media', 'Music'],
    rule: {
      type: 'regex',
      regex: 'Spotify|Deezer',
      ignore_case: true,
    },
    data: { color: '#A8FC00' },
  },
  {
    name: ['Comms'],
    rule: { type: 'none' },
    data: { color: '#9FF' },
  },
  {
    name: ['Comms', 'IM'],
    rule: {
      type: 'regex',
      regex:
        'Messenger|Telegram|Signal|WhatsApp|Rambox|Slack|Riot|Element|Discord|Nheko|NeoChat|Mattermost',
    },
  },
  { name: ['Comms', 'Email'], rule: { type: 'regex', regex: 'Gmail|Thunderbird|mutt|alpine' } },
  { name: ['Uncategorized'], rule: { type: null }, data: { color: COLOR_UNCAT } },
];

export function annotate(c: Category) {
  const ch = c.name;
  c.name_pretty = ch.join(level_sep);
  c.subname = ch.slice(-1)[0];
  c.parent = ch.length > 1 ? ch.slice(0, -1) : null;
  c.depth = ch.length - 1;
  return c;
}

export function createMissingParents(classes: Category[]): Category[] {
  // Creates parents for categories that are missing theirs (implicit parents)
  classes = _.cloneDeep(classes);
  classes = classes.slice().map(c => annotate(c));
  const all_full_names = new Set(classes.map(c => c.name.join(level_sep)));

  function _createMissing(children: Category[]) {
    children
      .map(c => c.parent)
      .filter(p => !!p)
      .map(p => {
        const name = p.join(level_sep);
        if (p && !all_full_names.has(name)) {
          const new_parent = annotate({ name: p, rule: { type: null } });
          //console.log('Creating missing parent:', new_parent);
          classes.push(new_parent);
          all_full_names.add(name);
          // New parent might not be top-level, so we need to recurse
          _createMissing([new_parent]);
        }
      });
  }

  _createMissing(classes);
  return classes;
}

export function build_category_hierarchy(classes: Category[]): Category[] {
  classes = createMissingParents(classes);

  function assignChildren(classes_at_level: Category[]) {
    return classes_at_level.map(cls => {
      cls.children = classes.filter(child => {
        return child.parent && cls.name
          ? JSON.stringify(child.parent) == JSON.stringify(cls.name)
          : false;
      });
      assignChildren(cls.children);
      return cls;
    });
  }

  return assignChildren(classes.filter(c => !c.parent));
}

export function flatten_category_hierarchy(hier: Category[]): Category[] {
  return _.flattenDeep(
    hier.map(h => {
      const level = [h, flatten_category_hierarchy(h.children)];
      h.children = [];
      return level;
    })
  );
}

function areWeTesting() {
  return process.env.NODE_ENV === 'test';
}

export function saveClasses(classes: Category[]) {
  if (areWeTesting()) {
    // TODO: move this into settings store?
    console.log('Not saving classes in test mode');
    return;
  }
  const settingsStore = useSettingsStore();
  settingsStore.update({ classes: classes.map(cleanCategory) });
  console.log('Saved classes', settingsStore.classes);
}

export function cleanCategory(cat: Category): Category {
  cat = _.cloneDeep(cat);
  delete cat.children;
  delete cat.parent;
  delete cat.subname;
  delete cat.name_pretty;
  delete cat.depth;
  // in an older version, type could be null (which is not allowed)
  // we also want to strip any excess properties that may have belonged to another rule type
  if (cat.rule && (cat.rule.type === null || cat.rule.type === 'none')) {
    cat.rule = { type: 'none' };
  }
  if (cat.rule) {
    cleanRuleConditions(cat.rule);
  }
  if (cat.extra_rules) {
    // Keep only rules that can still match something.
    cat.extra_rules = cat.extra_rules
      .filter(rule => rule && rule.type === 'regex')
      .map(rule => {
        cleanRuleConditions(rule);
        return rule;
      })
      .filter(rule => rule.regex || (rule.conditions || []).length > 0);
    if (cat.extra_rules.length === 0) {
      delete cat.extra_rules;
    }
  }
  return cat;
}

function cleanRuleConditions(rule: Rule) {
  if (!rule.conditions) {
    return;
  }
  // Drop conditions that could never be satisfied (no field or no pattern).
  rule.conditions = rule.conditions.filter(
    condition => condition && condition.field && condition.regex
  );
  if (rule.conditions.length === 0) {
    delete rule.conditions;
  }
}

export function loadClasses(): Category[] {
  const settingsStore = useSettingsStore();
  return settingsStore.classes;
}

function pickDeepest(categories: Category[]) {
  return _.maxBy(categories, c => c.name.length);
}

export function matchString(str: string, categories: Category[] | null): Category | null {
  if (!categories) {
    console.log(
      'Categories not passed, loading... (if you see this outside of a test, you should probably pass them)'
    );
    categories = loadClasses();
  }

  // Compile regexes. Rules with field conditions are skipped here: a bare
  // string carries no fields to check them against, so they can neither be
  // confirmed nor safely assumed.
  const regexes: [Category, RegExp][] = [];
  for (const c of categories) {
    for (const rule of categoryRules(c)) {
      if (!rule.regex || (rule.conditions || []).length > 0) {
        continue;
      }
      // using 'm' flag to make `$` and `^` in rules work
      regexes.push([c, RegExp(rule.regex, (rule.ignore_case ? 'i' : '') + 'm')]);
    }
  }

  // Find the matching category.
  // If several categories match the event, the deepest category will be chosen.
  const matchingCats: [Category, RegExp][] = regexes.filter(c => c[1].test(str));
  if (matchingCats.length > 0) {
    return pickDeepest(matchingCats.map(c => c[0]));
  }
  return null;
}

// this is used only in tests
export function classifyEvents(events: IEvent[], categories: Category[]): IEvent[] {
  // Compile every rule of every category (a category may have extra rules).
  const compiled: [Category, Rule, RegExp | null][] = [];
  for (const c of categories) {
    for (const rule of categoryRules(c)) {
      compiled.push([c, rule, rule.regex ? RegExp(rule.regex, rule.ignore_case ? 'i' : '') : null]);
    }
  }

  // Classify events using compiled regexes. Mirrors the server
  // (aw_transform.classify): all conditions must hold AND the primary regex
  // must hit one of the selected keys; a conditions-only rule is legal. The
  // deepest matching category wins; between equally deep matches the rule
  // with more conditions (the more specific one) wins.
  return events.map((e: IEvent) => {
    const matches = compiled.filter(([, rule, re]) => {
      if (!conditionsMatch(rule, e.data)) {
        return false;
      }
      if (!re) {
        return (rule.conditions || []).length > 0;
      }
      const keys = rule.select_keys?.length ? rule.select_keys : CLASSIFY_KEYS;
      return _.map(keys, key => typeof e.data[key] === 'string' && re.test(e.data[key])).some(
        x => x
      );
    });
    if (matches.length > 0) {
      // Same picker as the server: depth first, then condition count, and a
      // full tie goes to the later entry.
      let category = matches[0][0];
      let bestDepth = category.name.length;
      let bestConditions = (matches[0][1].conditions || []).length;
      for (const [c, rule] of matches.slice(1)) {
        const conditions = (rule.conditions || []).length;
        if (
          c.name.length > bestDepth ||
          (c.name.length === bestDepth && conditions >= bestConditions)
        ) {
          category = c;
          bestDepth = c.name.length;
          bestConditions = conditions;
        }
      }
      e.data.$category = category.name;
    } else {
      e.data.$category = UNCATEGORIZED;
    }
    return e;
  });
}
