<template lang="pug">
div.aw-categorytree(:class="{'aw-categorytree--horizontal': horizontal}")
  div.aw-categorytree-groups(v-if="horizontal")
    div.aw-categorytree-group(v-for="root in root_categories" :key="root.name_pretty")
      div.aw-categorytree-row.aw-categorytree-row--root(@click="toggle(root)", :title="category_tooltip(root)", :class="{'clickable': has_children(root)}")
        span.aw-categorytree-color(v-if="show_colors", :style="{ backgroundColor: category_color(root) }")
        span.aw-categorytree-icon(v-if="has_children(root)")
          b(v-if="!expanded.has(root.name_pretty)")
            icon(name="regular/plus-square", scale="0.8")
          b(v-else)
            icon(name="regular/minus-square", scale="0.8")
        span.aw-categorytree-icon.aw-categorytree-icon--leaf(v-else)
          icon(name="circle", scale="0.4")
        span.aw-categorytree-label {{root.subname}}
        span.aw-categorytree-duration {{format_category_value(root)}}
      div.aw-categorytree-row(
        v-for="cat in visible_descendants(root)"
        :key="cat.name_pretty"
        @click="toggle(cat)"
        :title="category_tooltip(cat)"
        :class="{'clickable': has_children(cat), 'aw-categorytree-row--app': cat.is_app_detail}"
      )
        span.aw-categorytree-indent(:style="'width: ' + (1.1 * Math.max(0, cat.depth - 1)) + 'em'")
        span.aw-categorytree-color(v-if="show_colors", :style="{ backgroundColor: category_color(cat) }")
        span.aw-categorytree-icon(v-if="has_children(cat)")
          b(v-if="!expanded.has(cat.name_pretty)")
            icon(name="regular/plus-square", scale="0.8")
          b(v-else)
            icon(name="regular/minus-square", scale="0.8")
        span.aw-categorytree-icon.aw-categorytree-icon--leaf(v-else)
          icon(name="circle", scale="0.4")
        span.aw-categorytree-label {{cat.subname}}
        span.aw-categorytree-duration {{format_category_value(cat)}}
  div.aw-categorytree-list(v-else)
    div.aw-categorytree-row.px-1(v-for="cat in category_hierarchy" @click="toggle(cat)" v-if="parents_expanded(cat)", :title="category_tooltip(cat)", :class="{'clickable': has_children(cat), 'aw-categorytree-row--app': cat.is_app_detail}")
      span.aw-categorytree-indent(:style="'width: ' + (1.4 * cat.depth) + 'em'")
      span.aw-categorytree-color(v-if="show_colors", :style="{ backgroundColor: category_color(cat) }")
      span.aw-categorytree-icon(v-if="has_children(cat)")
        b(v-if="!expanded.has(cat.name_pretty)")
          icon(name="regular/plus-square", scale="0.8")
        b(v-else)
          icon(name="regular/minus-square", scale="0.8")
      span.aw-categorytree-icon.aw-categorytree-icon--leaf(v-else)
        icon(name="circle", scale="0.4")
      span.aw-categorytree-label {{cat.subname}}
      span.aw-categorytree-duration {{format_category_value(cat)}}
  hr
  // TODO: Make configurable in a cleaner way (figure out a way to configure visualizations generally)
  b-checkbox(v-model="show_perc" size="sm") {{ $tr('Show percent') }}
</template>

<style lang="scss" scoped>
.aw-categorytree {
  font-size: 0.9em;
}

.clickable {
  cursor: pointer;
}

.aw-categorytree-groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 0.2rem 1.25rem;
}

.aw-categorytree-group {
  min-width: 0;
}

.aw-categorytree-row {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 0.12rem 0;
  gap: 0.35rem;
}

.aw-categorytree-row--root {
  font-weight: 600;
}

.aw-categorytree-row--app {
  font-size: 0.92em;
  opacity: 0.92;
}

.aw-categorytree-indent {
  flex: 0 0 auto;
}

.aw-categorytree-color {
  flex: 0 0 auto;
  width: 0.8rem;
  height: 0.8rem;
  border: 1px solid rgba(0, 0, 0, 0.2);
}

.aw-categorytree-icon {
  flex: 0 0 1.05rem;
  text-align: center;
  opacity: 0.8;
}

.aw-categorytree-icon--leaf {
  opacity: 0.6;
}

.aw-categorytree-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aw-categorytree-duration {
  flex: 0 0 auto;
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}
</style>

<script lang="ts">
import 'vue-awesome/icons/circle';
import 'vue-awesome/icons/regular/plus-square';
import 'vue-awesome/icons/regular/minus-square';
import _ from 'lodash';
import { build_category_hierarchy, flatten_category_hierarchy, Category } from '../util/classes.ts';
import { IEvent } from '../util/interfaces.ts';
import { useCategoryStore } from '~/stores/categories';
import { seconds_to_duration } from '~/util/time';

const UNKNOWN = 'Unknown';
const CATEGORY_KEY_SEPARATOR = '>>>';

function _category_key(category) {
  return (category && category.length > 0 ? category : ['Uncategorized']).join(
    CATEGORY_KEY_SEPARATOR
  );
}

function _get_child_cats(cat, all_cats) {
  return _.filter(all_cats, c => _.isEqual(c.parent, cat.name));
}

function _assign_children(parent, all_cats) {
  const child_cats = _get_child_cats(parent, all_cats);
  // Recurse
  _.map(child_cats, c => _assign_children(c, all_cats));
  parent.children = _.sortBy(child_cats, cc => -cc.duration);
}

// Flattens the category hierarchy
function _flatten_hierarchy(c) {
  if (!c.children) return [];
  return _.flattenDeep([c, _.map(c.children, cc => _flatten_hierarchy(cc))]);
}

function _sorted_duration_entries(values) {
  return _.orderBy(
    Array.from(values.entries()).map(([label, duration]) => ({
      label,
      duration,
    })),
    ['duration'],
    ['desc']
  ).filter(entry => entry.duration > 0);
}

export default {
  name: 'aw-categorytree',
  props: {
    events: { type: Array },
    show_colors: { type: Boolean, default: false },
    horizontal: { type: Boolean, default: false },
    expand_roots: { type: Boolean, default: false },
    expand_all: { type: Boolean, default: false },
    show_apps: { type: Boolean, default: false },
  },
  data: function () {
    return {
      expanded: new Set(),
      show_perc: false,
      categoryStore: useCategoryStore(),
      autoExpandedSignature: '',
      userToggled: false,
    };
  },
  computed: {
    total_duration: function () {
      // sum top-level categories
      const top_c = _.filter(this.category_hierarchy, c => c.depth == 0);
      return _.sumBy(top_c, c => c.duration);
    },
    category_hierarchy: function () {
      if (!this.events) return [];
      const events: IEvent[] = JSON.parse(JSON.stringify(this.events)) as IEvent[];

      const categoryClasses: Category[] = _.uniqBy(
        _.map(events, e => {
          return {
            name: e.data?.['$category'] || ['Uncategorized'],
            rule: { type: 'none' },
          } as Category;
        }),
        c => _category_key(c.name)
      );
      const hier = build_category_hierarchy(categoryClasses);

      let cats = flatten_category_hierarchy(hier).map(c => {
        c['duration'] = _.sumBy(
          events.filter(e => {
            const pcat = e.data['$category'].slice(0, c.name.length);
            return _.isEqual(c.name, pcat);
          }),
          e => e.duration
        );
        return c;
      });

      if (this.show_apps) {
        cats = cats.concat(this.build_app_detail_categories(cats, events));
      }

      const cats_with_depth0 = _.sortBy(
        _.filter(cats, c => c.depth == 0),
        c => -c['duration']
      );
      _.map(cats_with_depth0, c => _assign_children(c, cats));

      cats = _.flatten(_.map(cats_with_depth0, c => _flatten_hierarchy(c)));
      //console.log(cats);
      // TODO: If a category has children, but also activity attributed directly to the parent that does not belong to a child, then create a "Other" child containing the activity.
      return cats;
    },
    root_categories: function () {
      return _.filter(this.category_hierarchy, c => c.depth == 0);
    },
  },
  watch: {
    category_hierarchy: {
      immediate: true,
      handler: function (cats) {
        this.expand_default_roots(cats);
      },
    },
  },
  methods: {
    build_app_detail_categories: function (cats, events) {
      const categoryByKey = new Map((cats || []).map(cat => [_category_key(cat.name), cat]));
      const grouped = new Map();

      for (const event of events || []) {
        const category = event.data?.['$category'] || ['Uncategorized'];
        const parent = categoryByKey.get(_category_key(category));
        if (!parent) {
          continue;
        }

        const app = String(event.data?.app || event.data?.process_name || UNKNOWN);
        const groupKey = `${_category_key(category)}${CATEGORY_KEY_SEPARATOR}app:${app}`;
        const groupedApp = grouped.get(groupKey) || {
          app,
          category,
          parent,
          duration: 0,
          titles: new Map(),
        };
        const duration = Number(event.duration || 0);
        groupedApp.duration += duration;
        const title = String(event.data?.title || '(no title)');
        groupedApp.titles.set(title, Number(groupedApp.titles.get(title) || 0) + duration);
        grouped.set(groupKey, groupedApp);
      }

      return Array.from(grouped.values()).map(groupedApp => {
        return {
          name: groupedApp.category.concat([`app:${groupedApp.app}`]),
          parent: groupedApp.category,
          depth: groupedApp.parent.depth + 1,
          subname: groupedApp.app,
          name_pretty: `${groupedApp.category.join('>')}>app:${groupedApp.app}`,
          duration: groupedApp.duration,
          children: [],
          is_app_detail: true,
          category: groupedApp.category,
          title_breakdown: _sorted_duration_entries(groupedApp.titles).slice(0, 5),
        };
      });
    },
    get_category: function (cat_arr) {
      return _.find(this.category_hierarchy, c => _.isEqual(c.name, cat_arr));
    },
    toggle: function (cat) {
      if (!this.has_children(cat)) {
        return;
      }
      this.userToggled = true;
      if (this.expanded.has(cat.name_pretty)) {
        this.expanded.delete(cat.name_pretty);
      } else {
        this.expanded.add(cat.name_pretty);
      }
      // needed to trigger update, since Set isn't reactive in Vue 2
      this.expanded = new Set(this.expanded);
    },
    expand_default_roots: function (cats) {
      if ((!this.expand_roots && !this.expand_all) || this.userToggled) {
        return;
      }

      const expandableCats = _.filter(cats || [], c => {
        if (!this.has_children(c)) {
          return false;
        }
        return this.expand_all || c.depth == 0;
      });
      const rootKeys = expandableCats.map(c => c.name_pretty);
      const signature = rootKeys.join('|');
      if (signature === this.autoExpandedSignature) {
        return;
      }

      this.autoExpandedSignature = signature;
      this.expanded = new Set(rootKeys);
    },
    visible_descendants: function (root) {
      return _.filter(this.category_hierarchy, cat => {
        if (cat.depth <= root.depth) {
          return false;
        }
        const rootPath = root.name || [];
        const catPath = cat.name || [];
        return _.isEqual(catPath.slice(0, rootPath.length), rootPath) && this.parents_expanded(cat);
      });
    },
    parents_expanded: function (cat) {
      if (cat === undefined || !cat.parent) {
        // top-level category
        return true;
      }
      return (
        // Check grandparents recursively
        this.parents_expanded(this.get_category(cat.parent)) &&
        // Check parent
        this.expanded.has(cat.parent.join('>'))
      );
    },
    category_color: function (cat) {
      return this.categoryStore.get_category_color(
        cat.is_app_detail ? cat.category || [] : cat.name || []
      );
    },
    has_children: function (cat) {
      return (cat?.children || []).length > 0;
    },
    category_tooltip: function (cat) {
      if (!cat) {
        return '';
      }

      const lines = [cat.subname, seconds_to_duration(cat.duration)];
      if (cat.is_app_detail && cat.title_breakdown && cat.title_breakdown.length > 0) {
        lines.push('');
        lines.push(this.$tr('Top Window Titles'));
        cat.title_breakdown.forEach(entry => {
          lines.push(`${entry.label}: ${seconds_to_duration(entry.duration)}`);
        });
      }
      return lines.join('\n');
    },
    format_category_value: function (cat) {
      if (this.show_perc) {
        const total = Math.max(1, this.total_duration);
        return `${Math.round((1000 * cat.duration) / total) / 10}%`;
      }
      return seconds_to_duration(cat.duration);
    },
  },
};
</script>
