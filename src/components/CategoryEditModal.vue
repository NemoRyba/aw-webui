<template lang="pug">
// The category edit modal
b-modal(id="edit" ref="edit" title="Edit category" @show="resetModal" @hidden="hidden" @ok="handleOk")
  div.my-1
    b-input-group.my-1(prepend="Name")
      b-form-input(v-model="editing.name")
    b-input-group(prepend="Parent")
      b-select(v-model="editing.parent", :options="allCategories")
    //| ID: {{editing.id}}

  hr
  div.my-1
    b Rule
    b-input-group.my-1(prepend="Type")
      b-select(v-model="editing.rule.type", :options="allRuleTypes")
    div(v-if="editing.rule.type === 'regex'")
      b-input-group.my-1(prepend="Pattern")
        b-form-input(v-model="editing.rule.regex")
      b-input-group.my-1(prepend="Fields")
        b-form-input(
          v-model="editing.select_keys_text"
          placeholder="app,title"
        )
      div.d-flex
        div.flex-grow-1
          b-form-checkbox(v-model="editing.rule.ignore_case" switch)
            | Case insensitive
        div.flex-grow-1
          small.text-right
            //div(v-if="valid" style="color: green") Valid
            div(v-if="!validPattern" style="color: red") Invalid pattern
            div(v-if="validPattern && broad_pattern" style="color: orange") Pattern too broad
      div.mt-1
        div.d-flex.align-items-center
          small.text-muted Field conditions (all must also match)
          b-btn.ml-2(size="sm" variant="outline-secondary" @click="addCondition(editing.rule)") Add condition
        b-input-group.my-1(v-for="(cond, ci) in editing.rule.conditions" :key="'mc' + ci")
          b-form-input(v-model="cond.field" placeholder="title" style="max-width: 9rem")
          b-form-input(v-model="cond.regex" placeholder="pattern")
          b-input-group-append
            b-btn(variant="outline-danger" @click="editing.rule.conditions.splice(ci, 1)")
              icon(name="trash")
        small(v-if="!conditionsOk(editing.rule)" style="color: red") Conditions need a field and a valid pattern

  hr
  div.my-1
    div.d-flex.align-items-center
      b Additional rules
      b-btn.ml-2(size="sm" variant="outline-secondary" @click="addExtraRule") Add rule
    small.text-muted.d-block
      | Independent rules that also match this category. Useful for host apps
      | like ApplicationFrameHost.exe where an app + title check is needed.
    div.extra-rule.my-2(v-for="(rule, ri) in editing.extra_rules" :key="'er' + ri")
      b-input-group.my-1(prepend="Pattern")
        b-form-input(v-model="rule.regex")
      b-input-group.my-1(prepend="Fields")
        b-form-input(v-model="rule.select_keys_text" placeholder="app,title")
      div.d-flex.align-items-center
        small.text-muted Field conditions (all must also match)
        b-btn.ml-2(size="sm" variant="outline-secondary" @click="addCondition(rule)") Add condition
      b-input-group.my-1(v-for="(cond, ci) in rule.conditions" :key="'ec' + ri + '-' + ci")
        b-form-input(v-model="cond.field" placeholder="title" style="max-width: 9rem")
        b-form-input(v-model="cond.regex" placeholder="pattern")
        b-input-group-append
          b-btn(variant="outline-danger" @click="rule.conditions.splice(ci, 1)")
            icon(name="trash")
      div.d-flex.justify-content-between.align-items-center
        small(v-if="!extraRuleOk(rule)" style="color: red") Rule needs a valid pattern or condition
        small(v-else)
        b-btn(size="sm" variant="outline-danger" @click="editing.extra_rules.splice(ri, 1)")
          icon(name="trash")
          |  Remove rule

  hr
  div.my-1
    b Color

    b-form-checkbox(v-model="editing.inherit_color" switch)
      | Inherit parent color
    div.mt-1(v-show="!editing.inherit_color")
      color-picker(v-model="editing.color")

  hr
  div.my-1
    b Productivity score
    b-form-checkbox(v-model="editing.inherit_score" switch)
      | Inherit parent score
    b-input-group.my-1(prepend="Score" v-if="!editing.inherit_score")
      b-form-input(v-model="editing.score")

  hr
  div.my-1
    b-btn(variant="danger", @click="removeClass(categoryId); $refs.edit.hide()")
      icon(name="trash")
      | Remove category
</template>

<script lang="ts">
import _ from 'lodash';
import ColorPicker from '~/components/ColorPicker.vue';
import { useCategoryStore } from '~/stores/categories';
import { mapState } from 'pinia';
import { validateRegex, isRegexBroad } from '~/util/validate';

import 'vue-awesome/icons/trash';

export default {
  name: 'CategoryEditModal',
  components: {
    'color-picker': ColorPicker,
  },
  props: {
    categoryId: { type: Number, required: true },
  },
  data: function () {
    return {
      categoryStore: useCategoryStore(),

      editing: {
        id: 0, // FIXME: Use ID assigned to category in store, in order for saves to be uniquely targeted
        name: null,
        rule: {},
        extra_rules: [],
        parent: [],
        select_keys_text: '',
        inherit_color: true,
        color: null,
        inherit_score: true,
        score: null,
      },
    };
  },
  computed: {
    ...mapState(useCategoryStore, {
      allCategories: state => [{ value: [], text: 'None' }].concat(state.allCategoriesSelect),
    }),
    allRuleTypes: function () {
      return [
        { value: 'none', text: 'None' },
        { value: 'regex', text: 'Regular Expression' },
        //{ value: 'glob', text: 'Glob pattern' },
      ];
    },
    valid: function () {
      return this.editing.rule.type !== 'none' && this.validPattern;
    },
    validPattern: function () {
      return this.editing.rule.type === 'regex' && validateRegex(this.editing.rule.regex || '');
    },
    broad_pattern: function () {
      return this.editing.rule.type === 'regex' && isRegexBroad(this.editing.rule.regex || '');
    },
  },
  watch: {
    categoryId: function (new_value) {
      if (new_value !== null) {
        this.showModal();
      }
    },
  },
  mounted: function () {
    if (this.categoryId !== null) {
      this.showModal();
    }
  },
  methods: {
    showModal() {
      this.$refs.edit.show();
    },
    hidden() {
      this.$emit('hidden');
    },
    removeClass() {
      // TODO: Show a confirmation dialog
      // TODO: Remove children as well?
      this.categoryStore.removeClass(this.categoryId);
    },
    addCondition(rule) {
      rule.conditions.push({ field: '', regex: '' });
    },
    addExtraRule() {
      this.editing.extra_rules.push({
        type: 'regex',
        regex: '',
        ignore_case: true,
        select_keys_text: 'app',
        conditions: [{ field: 'title', regex: '' }],
      });
    },
    conditionsOk(rule) {
      return (rule.conditions || []).every(
        cond => cond.field && cond.regex && validateRegex(cond.regex)
      );
    },
    extraRuleOk(rule) {
      if (rule.regex && !validateRegex(rule.regex)) {
        return false;
      }
      if (!this.conditionsOk(rule)) {
        return false;
      }
      return Boolean(rule.regex) || (rule.conditions || []).some(cond => cond.field && cond.regex);
    },
    parseSelectKeys(text) {
      return String(text || '')
        .split(',')
        .map(key => key.trim())
        .filter(key => key.length > 0);
    },
    cleanedConditions(rule) {
      const conditions = (rule.conditions || []).filter(cond => cond.field && cond.regex);
      return conditions.length > 0 ? conditions : undefined;
    },
    checkFormValidity() {
      // FIXME
      return true;
    },
    handleOk(event) {
      // Prevent modal from closing
      event.preventDefault();
      // Trigger submit handler
      this.handleSubmit();
      this.$emit('ok');
    },
    handleSubmit() {
      // Exit when the form isn't valid
      if (!this.checkFormValidity()) {
        return;
      }

      // Save the category
      const rule = _.cloneDeep(this.editing.rule);
      const select_keys = this.parseSelectKeys(this.editing.select_keys_text);
      if (select_keys.length > 0) {
        rule.select_keys = select_keys;
      } else {
        delete rule.select_keys;
      }
      const conditions = this.cleanedConditions(rule);
      if (conditions) {
        rule.conditions = conditions;
      } else {
        delete rule.conditions;
      }

      // Always assign extra_rules (possibly empty): updateClass merges via
      // Object.assign, so omitting the key would keep deleted rules alive.
      const extra_rules = _.cloneDeep(this.editing.extra_rules || [])
        .map(extra => {
          const cleaned: any = {
            type: 'regex',
            regex: extra.regex || undefined,
            ignore_case: extra.ignore_case,
          };
          const keys = this.parseSelectKeys(extra.select_keys_text);
          if (keys.length > 0) {
            cleaned.select_keys = keys;
          }
          const extraConditions = this.cleanedConditions(extra);
          if (extraConditions) {
            cleaned.conditions = extraConditions;
          }
          return cleaned;
        })
        .filter(extra => extra.regex || extra.conditions);

      const new_class = {
        id: this.editing.id,
        name: this.editing.parent.concat(this.editing.name),
        rule: this.editing.rule.type !== 'none' ? rule : { type: 'none' },
        extra_rules,
        data: {
          color: this.editing.inherit_color === true ? undefined : this.editing.color,
          score: this.editing.inherit_score === true ? undefined : this.editing.score,
        },
      };
      this.categoryStore.updateClass(new_class);

      // Hide the modal manually
      this.$nextTick(() => {
        this.$refs.edit.hide();
      });
    },
    resetModal() {
      const cat = this.categoryStore.get_category_by_id(this.categoryId);
      const color = cat.data ? cat.data.color : undefined;
      const inherit_color = !color;
      const score = cat.data ? cat.data.score : undefined;
      const inherit_score = !score;
      const rule = _.cloneDeep(cat.rule);
      // Normalize so Vue 2 sees every key from the start (no reactivity
      // holes when conditions are added later).
      rule.conditions = rule.conditions || [];
      const extra_rules = _.cloneDeep(cat.extra_rules || []).map(extra => ({
        type: 'regex',
        regex: extra.regex || '',
        ignore_case: extra.ignore_case !== false,
        select_keys_text: (extra.select_keys || []).join(','),
        conditions: extra.conditions || [],
      }));
      this.editing = {
        id: cat.id,
        name: cat.subname,
        rule,
        extra_rules,
        parent: cat.parent ? cat.parent : [],
        select_keys_text: (cat.rule.select_keys || []).join(','),
        color,
        inherit_color,
        score,
        inherit_score,
      };
    },
  },
};
</script>
