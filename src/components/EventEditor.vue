<template lang="pug">
b-modal(v-if="event && event.id", :id="'edit-modal-' + event.id", ref="eventEditModal", title="Edit event", centered, size="lg", hide-footer, @hidden="handleHidden")
  div(v-if="!editedEvent")
    | Loading event...

  div(v-else)
    table(style="width: 100%")
      tr
        th Bucket
        td {{ bucket_id }}
      tr
        th ID
        td {{ event.id }}
      tr
        th Start
        datetime(type="datetime" v-model="start")
      tr
        th End
        datetime(type="datetime" v-model="end")
      tr
        th Duration
        td {{ editedEvent.duration | friendlyduration }}

    hr

    table.event-data-table
      tr
        th Key
        th Value
      tr(v-for="k in editableDataKeys" :key="k")
        td
          b-input(disabled, :value="k", size="sm")
        td
          b-checkbox(v-if="typeof editedEvent.data[k] === typeof true", v-model="editedEvent.data[k]", style="margin: 0.25em")
          b-input(v-if="typeof editedEvent.data[k] === typeof 'string'", v-model="editedEvent.data[k]", size="sm")
          b-input(v-if="typeof editedEvent.data[k] === 'number'", v-model.number="editedEvent.data[k]", size="sm", type="number")

    div.event-provenance.mt-3(v-if="provenanceLines.length > 0")
      h6.mb-1 {{ $tr('History') }}
      div.small.text-muted(v-for="(line, index) in provenanceLines" :key="index")
        | {{ line }}

    div.category-rule-panel.mt-3(v-if="categorizationAvailable")
      div.d-flex.align-items-center.mb-2
        h6.mb-0 {{ $tr('Categorize matching events') }}
        b-badge.ml-2(variant="secondary" v-if="currentCategoryLabel") {{ currentCategoryLabel }}

      b-alert(:show="!!categoryRuleMessage", variant="success")
        | {{ categoryRuleMessage }}
      b-alert(:show="!!categoryRuleDisplayError", variant="danger")
        | {{ categoryRuleDisplayError }}
      b-alert(:show="!!categoryRuleWarning", variant="warning")
        | {{ categoryRuleWarning }}

      div.row
        div.col-md-6
          b-form-group(:label="$tr('Match from')")
            b-form-select(
              v-model="categoryRuleField"
              :options="categoryFieldOptions"
              size="sm"
            )
        div.col-md-6
          b-form-group(:label="$tr('Target')")
            b-form-radio-group(
              v-model="categoryRuleMode"
              :options="categoryRuleModeOptions"
              size="sm"
              buttons
              button-variant="outline-secondary"
            )

      div.mb-2(v-if="selectedCategoryFieldValue")
        small.text-muted {{ $tr('Field value') }}
        code.category-rule-value {{ selectedCategoryFieldValue }}

      b-form-group(:label="$tr('Generated regex')")
        b-form-input(
          v-model.trim="categoryRulePattern"
          :state="categoryRulePatternState"
          size="sm"
        )
        b-form-invalid-feedback
          | {{ $tr('Invalid pattern') }}
        b-form-text.text-warning(v-if="categoryRuleBroadPattern")
          | {{ $tr('Pattern too broad') }}

      div.mb-2
        div.d-flex.align-items-center.mb-1
          small.text-muted {{ $tr('Additional field checks') }}
          b-button.ml-2(
            size="sm"
            variant="outline-secondary"
            :disabled="!availableConditionFields.length"
            @click="addCategoryRuleCondition"
          )
            | {{ $tr('Add field check') }}
        div.row.mb-1(v-for="(condition, index) in categoryRuleConditions" :key="index")
          div.col-md-4
            b-form-select(
              v-model="condition.field"
              :options="conditionFieldOptions(index)"
              size="sm"
              @change="onConditionFieldChange(condition)"
            )
          div.col-md-6
            b-form-input(
              v-model.trim="condition.pattern"
              :state="conditionPatternState(condition)"
              size="sm"
            )
          div.col-md-2
            b-button(
              size="sm"
              variant="outline-danger"
              @click="removeCategoryRuleCondition(index)"
            )
              | {{ $tr('Remove') }}
        small.text-muted(v-if="categoryRuleConditions.length")
          | {{ $tr('All checks must match in addition to the pattern.') }}

      b-alert(:show="categoryRuleMode === 'append' && categoryRuleConditions.length > 0" variant="info")
        | {{ $tr('Saved as an additional rule; the existing rule of the category stays unchanged.') }}

      div.row
        div.col-md-7(v-if="categoryRuleMode === 'append'")
          b-form-group(:label="$tr('Existing category')")
            b-form-select(
              v-model="categoryRuleCategory"
              :options="appendCategoryOptions"
              size="sm"
            )
        div.col-md-7(v-else)
          b-form-group(:label="$tr('New category path')")
            b-form-input(
              v-model.trim="categoryRuleNewPath"
              :placeholder="$tr('Work > Project')"
              size="sm"
            )
        div.col-md-5.d-flex.align-items-end
          b-form-checkbox.mb-3(v-model="categoryRuleIgnoreCase")
            | {{ $tr('Case insensitive') }}

      div.d-flex.justify-content-end
        b-button(
          size="sm"
          variant="primary"
          :disabled="!categoryRuleCanSave || categoryRuleSaving"
          @click="saveCategoryRule"
        )
          | {{ categoryRuleSaving ? $tr('Saving...') : $tr('Save category rule') }}

    hr

    div.float-left
      b-button.mx-1(@click="confirmDelete" variant="danger")
        icon.mx-1(name="trash")
        | {{ $tr('Delete') }}
      b-button.mx-1(v-if="isTrashedEvent" @click="restore" variant="success")
        | {{ $tr('Restore') }}
    div.float-right
      b-button.mx-1(@click="close")
        icon.mx-1(name="times")
        | Cancel
      b-button.mx-1(@click="save(); close();", variant="primary")
        icon.mx-1(name="save")
        | Save
</template>

<style lang="scss" scoped>
.event-data-table {
  width: 100%;
}

.event-data-table th {
  width: 9rem;
}

.category-rule-panel {
  border: 1px solid rgba(128, 128, 128, 0.35);
  border-radius: 0.35rem;
  padding: 0.75rem;
}

.category-rule-value {
  display: block;
  max-height: 5rem;
  overflow: auto;
  padding: 0.35rem 0.5rem;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

<script lang="ts">
// This EventEditor can be used to edit events in a specific bucket.
//
// It is used in:
//  - Stopwatch
//  - Bucket viewer
//  - Timeline (on event-click)
//  - Search (soon)

import _ from 'lodash';
import moment from 'moment';

import 'vue-awesome/icons/times';
import 'vue-awesome/icons/save';
import 'vue-awesome/icons/trash';

import { useCategoryStore } from '~/stores/categories';
import { validateRegex, isRegexBroad } from '~/util/validate';

const PREFERRED_CATEGORY_FIELDS = [
  'app',
  'title',
  'process_name',
  'process_path',
  'path',
  'url',
  'browser_url',
  'domain',
  'classname',
  'state',
  'status',
];

export default {
  name: 'EventEditor',
  props: {
    event: { type: Object },
    bucket_id: { type: String, required: true },
  },
  data() {
    return {
      categoryStore: useCategoryStore(),
      editedEvent: null,
      categoryRuleMode: 'append',
      categoryRuleField: '',
      categoryRuleConditions: [],
      categoryRulePattern: '',
      categoryRuleCategory: null,
      categoryRuleNewPath: '',
      categoryRuleIgnoreCase: true,
      categoryRuleSaving: false,
      categoryRuleMessage: '',
      categoryRuleError: '',
    };
  },
  computed: {
    isTrashedEvent() {
      return Boolean(this.editedEvent?.data?.$deleted);
    },
    editableDataKeys() {
      // Keys starting with $ are internal/audit metadata ($manual, $edits,
      // $category, ...) and are not edited by hand.
      return Object.keys(this.editedEvent?.data || {}).filter(key => !key.startsWith('$'));
    },
    provenanceLines() {
      const data = this.editedEvent?.data || {};
      const lines = [];
      if (data.$manual) {
        lines.push(this.$tr('Manually created event'));
      }
      const edits = Array.isArray(data.$edits) ? data.$edits : [];
      for (const entry of edits) {
        const action = entry?.action === 'created' ? this.$tr('Created') : this.$tr('Edited');
        const at = entry?.at ? new Date(entry.at).toLocaleString() : '';
        lines.push(`${action}: ${entry?.by || '?'} — ${at}`);
      }
      return lines;
    },
    start: {
      get: function () {
        return moment(this.editedEvent.timestamp).format();
      },
      set: function (dt) {
        // Duration needs to be set first since otherwise the computed for end will use the new timestamp
        this.editedEvent.duration = moment(this.end).diff(dt, 'seconds');
        this.editedEvent.timestamp = new Date(dt);
      },
    },
    end: {
      get: function () {
        const end = moment(this.editedEvent.timestamp).add(this.editedEvent.duration, 'seconds');
        return end.format();
      },
      set: function (dt) {
        this.editedEvent.duration = moment(dt).diff(this.editedEvent.timestamp, 'seconds');
      },
    },
    categoryFieldOptions() {
      const data = this.editedEvent?.data || {};
      const keys = Object.keys(data).filter(key => {
        if (key.startsWith('$')) {
          return false;
        }
        const value = data[key];
        return typeof value === 'string' && value.trim().length > 0;
      });

      const orderedKeys = _.uniq(
        PREFERRED_CATEGORY_FIELDS.filter(key => keys.includes(key)).concat(keys.sort())
      );

      return orderedKeys.map(key => ({
        value: key,
        text: `${key}: ${this.truncateValue(data[key])}`,
      }));
    },
    categorizationAvailable() {
      return this.categoryFieldOptions.length > 0;
    },
    categoryRuleModeOptions() {
      return [
        { value: 'append', text: this.$tr('Existing category') },
        { value: 'create', text: this.$tr('New category') },
      ];
    },
    appendCategoryOptions() {
      return [
        { value: null, text: this.$tr('Choose category'), disabled: true },
        ...this.categoryStore.category_select(false).filter(option => {
          return option.value && !_.isEqual(option.value, ['Uncategorized']);
        }),
      ];
    },
    selectedCategoryFieldValue() {
      if (!this.categoryRuleField) {
        return '';
      }
      return String(this.editedEvent?.data?.[this.categoryRuleField] || '');
    },
    categoryRulePatternState() {
      if (!this.categoryRulePattern) {
        return null;
      }
      return validateRegex(this.categoryRulePattern);
    },
    categoryRuleBroadPattern() {
      return this.categoryRulePatternState && isRegexBroad(this.categoryRulePattern);
    },
    newCategoryParts() {
      return String(this.categoryRuleNewPath || '')
        .split('>')
        .map(part => part.trim())
        .filter(part => part.length > 0);
    },
    newCategoryExists() {
      if (this.categoryRuleMode !== 'create' || this.newCategoryParts.length === 0) {
        return false;
      }
      return this.categoryStore.classes.some(category =>
        _.isEqual(category.name, this.newCategoryParts)
      );
    },
    selectedCategory() {
      if (!this.categoryRuleCategory) {
        return null;
      }
      return this.categoryStore.classes.find(category =>
        _.isEqual(category.name, this.categoryRuleCategory)
      );
    },
    availableConditionFields() {
      const used = new Set([
        this.categoryRuleField,
        ...this.categoryRuleConditions.map(condition => condition.field),
      ]);
      return this.categoryFieldOptions
        .map(option => option.value)
        .filter(field => !used.has(field));
    },
    conditionsValid() {
      return this.categoryRuleConditions.every(
        condition => condition.field && validateRegex(condition.pattern || '')
      );
    },
    appendCompatibilityError() {
      // A conditioned rule is stored as an independent extra rule with its
      // own field scope, so the existing rule's select_keys do not apply.
      if (this.categoryRuleConditions.length > 0) {
        return '';
      }
      const category = this.selectedCategory;
      if (!category || category.rule?.type !== 'regex') {
        return '';
      }
      const selectKeys = category.rule.select_keys || [];
      if (selectKeys.length > 0 && !selectKeys.includes(this.categoryRuleField)) {
        return this.$tr(
          'Selected category only matches other fields. Choose a compatible field or create a new category.'
        );
      }
      return '';
    },
    categoryRuleDisplayError() {
      return this.categoryRuleError || this.appendCompatibilityError;
    },
    categoryRuleWarning() {
      const category = this.selectedCategory;
      if (this.appendCompatibilityError) {
        return '';
      }
      if (
        this.categoryRuleMode === 'append' &&
        this.categoryRuleConditions.length === 0 &&
        category?.rule?.type === 'regex' &&
        !(category.rule.select_keys || []).length
      ) {
        return this.$tr(
          'Existing category has no field scope; the new pattern can match any categorized field.'
        );
      }
      if (this.newCategoryExists) {
        return this.$tr('Category already exists');
      }
      return '';
    },
    categoryRuleCanSave() {
      if (!this.categorizationAvailable || !validateRegex(this.categoryRulePattern || '')) {
        return false;
      }
      if (!this.conditionsValid) {
        return false;
      }
      if (this.appendCompatibilityError || this.newCategoryExists) {
        return false;
      }
      if (this.categoryRuleMode === 'append') {
        return !!this.selectedCategory;
      }
      return this.newCategoryParts.length > 0;
    },
    currentCategoryLabel() {
      const category = this.editedEvent?.data?.$category;
      return Array.isArray(category) ? category.join(' > ') : '';
    },
  },
  watch: {
    async event() {
      await this.getEvent();
    },
    categoryRuleField() {
      this.categoryRulePattern = this.generatedRulePattern();
      this.categoryRuleConditions = this.categoryRuleConditions.filter(
        condition => condition.field !== this.categoryRuleField
      );
      this.categoryRuleMessage = '';
      this.categoryRuleError = '';
    },
    categoryRuleMode() {
      this.categoryRuleMessage = '';
      this.categoryRuleError = '';
    },
  },
  mounted: async function () {
    if (this.categoryStore.classes.length === 0) {
      this.categoryStore.load();
    }
    await this.getEvent();
  },
  methods: {
    async save() {
      // This emit needs to be called first, otherwise it won't occur for some reason
      // FIXME: but what if the replace fails? Then UI will incorrectly think event was replaced?
      this.$emit('save', this.editedEvent);
      await this.$aw.replaceEvent(this.bucket_id, this.editedEvent);
    },
    async confirmDelete() {
      const confirmed = await this.$bvModal.msgBoxConfirm(
        this.$tr(
          'Delete this event? It is moved to the trash bucket and can be restored from there.'
        ),
        {
          title: this.$tr('Delete event'),
          okVariant: 'danger',
          okTitle: this.$tr('Delete'),
          cancelTitle: this.$tr('Cancel'),
          centered: true,
        }
      );
      if (!confirmed) {
        return;
      }
      await this.delete_();
      this.close();
    },
    async delete_() {
      // This emit needs to be called first, otherwise it won't occur for some reason
      // FIXME: but what if the replace fails? Then UI will incorrectly think event was deleted?
      this.$emit('delete', this.event);
      await this.$aw.deleteEvent(this.bucket_id, this.event.id);
    },
    async restore() {
      try {
        await this.$aw.req.post(
          '/0/buckets/' +
            encodeURIComponent(this.bucket_id) +
            '/events/' +
            encodeURIComponent(this.event.id) +
            '/restore'
        );
        // Treat like a removal from THIS (trash) bucket so the timeline refreshes.
        this.$emit('delete', this.event);
        this.close();
      } catch (error) {
        console.error('Unable to restore event:', error);
      }
    },
    async getEvent() {
      if (this.bucket_id && this.event && this.event.id) {
        this.editedEvent = await this.$aw.getEvent(this.bucket_id, this.event.id);
        this.resetCategoryRuleDefaults();
      } else {
        this.editedEvent = null;
      }
    },
    resetCategoryRuleDefaults() {
      this.categoryRuleMessage = '';
      this.categoryRuleError = '';
      this.categoryRuleMode = 'append';
      this.categoryRuleField = this.categoryFieldOptions[0]?.value || '';
      this.categoryRulePattern = this.generatedRulePattern();
      this.categoryRuleIgnoreCase = true;
      this.categoryRuleNewPath = '';
      this.categoryRuleConditions = [];

      const eventCategory = this.editedEvent?.data?.$category;
      const knownEventCategory =
        Array.isArray(eventCategory) &&
        !_.isEqual(eventCategory, ['Uncategorized']) &&
        this.categoryStore.classes.some(category => _.isEqual(category.name, eventCategory));
      this.categoryRuleCategory = knownEventCategory ? eventCategory : null;
    },
    generatedRulePattern() {
      const value = this.selectedCategoryFieldValue;
      return value ? _.escapeRegExp(value) : '';
    },
    addCategoryRuleCondition() {
      const field = this.availableConditionFields[0];
      if (!field) {
        return;
      }
      this.categoryRuleConditions.push({
        field,
        pattern: _.escapeRegExp(String(this.editedEvent?.data?.[field] || '')),
      });
    },
    removeCategoryRuleCondition(index) {
      this.categoryRuleConditions.splice(index, 1);
    },
    onConditionFieldChange(condition) {
      // Prefill the pattern from the event, like the primary field does.
      condition.pattern = _.escapeRegExp(String(this.editedEvent?.data?.[condition.field] || ''));
    },
    conditionFieldOptions(index) {
      // Offer unused fields plus the row's current one, so a row keeps its
      // selection while other rows cannot pick the same field twice.
      const current = this.categoryRuleConditions[index]?.field;
      return this.categoryFieldOptions.filter(
        option => option.value === current || this.availableConditionFields.includes(option.value)
      );
    },
    conditionPatternState(condition) {
      if (!condition.pattern) {
        return false;
      }
      return validateRegex(condition.pattern);
    },
    truncateValue(value) {
      const text = String(value || '');
      return text.length > 72 ? `${text.slice(0, 69)}...` : text;
    },
    buildRule() {
      const rule: any = {
        type: 'regex',
        regex: this.categoryRulePattern,
        ignore_case: this.categoryRuleIgnoreCase,
      };
      if (this.categoryRuleField) {
        rule.select_keys = [this.categoryRuleField];
      }
      if (this.categoryRuleConditions.length > 0) {
        rule.conditions = this.categoryRuleConditions.map(condition => ({
          field: condition.field,
          regex: condition.pattern,
          ignore_case: this.categoryRuleIgnoreCase,
        }));
      }
      return rule;
    },
    async saveCategoryRule() {
      if (!this.categoryRuleCanSave) {
        return;
      }

      this.categoryRuleSaving = true;
      this.categoryRuleMessage = '';
      this.categoryRuleError = '';

      try {
        if (this.categoryRuleMode === 'create') {
          this.categoryStore.addClass({
            name: this.newCategoryParts,
            rule: this.buildRule(),
          });
        } else {
          const category = this.selectedCategory;
          if (!category) {
            throw new Error(this.$tr('Choose category'));
          }
          const rule = category.rule || { type: 'none' };
          if (this.categoryRuleConditions.length > 0) {
            // A conditioned rule must not be OR-ed into the existing regex -
            // that would drop the AND semantics. Store it as an independent
            // extra rule; the category's existing rule stays untouched.
            this.categoryStore.addExtraRuleToClass(category.name, this.buildRule());
          } else if (rule.type === 'none' || rule.type === null) {
            category.rule = this.buildRule();
            this.categoryStore.classes_unsaved_changes = true;
          } else if (rule.type === 'regex') {
            category.rule.regex = `${rule.regex || ''}|${this.categoryRulePattern}`;
            if (rule.ignore_case === undefined) {
              category.rule.ignore_case = this.categoryRuleIgnoreCase;
            }
            this.categoryStore.classes_unsaved_changes = true;
          }
        }

        await this.categoryStore.save();
        this.categoryStore.load();
        this.resetCategoryRuleDefaults();
        this.categoryRuleMessage = this.$tr('Category rule saved');
      } catch (e) {
        this.categoryRuleError = e?.message || String(e);
      } finally {
        this.categoryRuleSaving = false;
      }
    },
    close() {
      this.$refs.eventEditModal.hide();
      this.$emit('close', this.event);
    },
    handleHidden() {
      this.$emit('hidden', this.event);
    },
  },
};
</script>
