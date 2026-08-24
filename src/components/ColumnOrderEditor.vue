<template lang="pug">
div.d-inline-block
  b-button(size="sm" variant="outline-secondary" @click="open")
    | {{ $tr('Columns') }}

  b-modal(
    v-model="show"
    size="sm"
    :title="allowVisibility ? $tr('Configure columns') : $tr('Reorder columns')"
    hide-footer
    @show="resetLocalFields"
  )
    div.small.text-muted.mb-3
      | {{ allowVisibility ? $tr('Drag columns to change the order and choose which columns are visible') : $tr('Drag columns to change the order') }}

    draggable(v-model="localFields" handle=".drag-handle")
      div.d-flex.align-items-center.justify-content-between.border.rounded.px-3.py-2.mb-2(
        v-for="field in localFields"
        :key="field.key"
      )
        span.drag-handle.mr-3(style="cursor: grab; user-select: none;")
          | ≡
        span.flex-grow-1
          | {{ columnLabel(field) }}
        b-form-checkbox.ml-3(
          v-if="allowVisibility"
          :checked="!field.hidden"
          switch
          :disabled="!field.hideable"
          :title="field.hideable ? $tr('Show column') : $tr('Column is always visible')"
          @change="toggleVisibility(field.key, $event)"
        )

    div.d-flex.justify-content-between.mt-3
      b-button(size="sm" variant="outline-secondary" @click="resetOrder")
        | {{ $tr('Reset to default') }}
      div
        b-button.mr-2(size="sm" variant="outline-secondary" @click="show = false")
          | {{ $tr('Close') }}
        b-button(size="sm" variant="primary" @click="save")
          | {{ $tr('Save') }}
</template>

<script lang="ts">
import draggable from 'vuedraggable';

import { useSettingsStore } from '~/stores/settings';
import { orderFields } from '~/util/columnOrder';

export default {
  name: 'ColumnOrderEditor',
  components: {
    draggable,
  },
  props: {
    tableKey: {
      type: String,
      required: true,
    },
    fields: {
      type: Array,
      required: true,
    },
    allowVisibility: {
      type: Boolean,
      default: false,
    },
    defaultHiddenColumns: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      settingsStore: useSettingsStore(),
      show: false,
      localFields: [],
    };
  },
  computed: {
    savedOrder() {
      return this.settingsStore.columnOrdersData?.[this.tableKey] || [];
    },
    savedHiddenColumns() {
      const visibility = this.settingsStore.columnVisibilityData || {};
      if (Object.prototype.hasOwnProperty.call(visibility, this.tableKey)) {
        return visibility[this.tableKey] || [];
      }
      return this.defaultHiddenColumns;
    },
    orderedFields() {
      return orderFields(this.fields, this.savedOrder);
    },
  },
  methods: {
    open() {
      this.resetLocalFields();
      this.show = true;
    },
    resetLocalFields() {
      const hiddenColumns = new Set(this.savedHiddenColumns);
      this.localFields = this.orderedFields.map(field => ({
        key: field.key,
        label: field.label,
        controlLabel: field.controlLabel,
        hideable: field.hideable !== false,
        hidden: hiddenColumns.has(field.key) && field.hideable !== false,
      }));
    },
    resetOrder() {
      const defaultHiddenColumns = new Set(this.defaultHiddenColumns);
      this.localFields = this.fields.map(field => ({
        key: field.key,
        label: field.label,
        controlLabel: field.controlLabel,
        hideable: field.hideable !== false,
        hidden: defaultHiddenColumns.has(field.key) && field.hideable !== false,
      }));
    },
    columnLabel(field) {
      return field.controlLabel || field.label || field.key;
    },
    toggleVisibility(key, visible) {
      this.localFields = this.localFields.map(field =>
        field.key === key
          ? {
              ...field,
              hidden: field.hideable ? !visible : false,
            }
          : field
      );
    },
    async save() {
      const nextColumnOrders = {
        ...(this.settingsStore.columnOrdersData || {}),
      };
      const nextColumnVisibility = {
        ...(this.settingsStore.columnVisibilityData || {}),
      };
      const defaultOrder = this.fields.map(field => field.key);
      const currentOrder = this.localFields.map(field => field.key);
      const hiddenColumns = this.localFields
        .filter(field => field.hideable && field.hidden)
        .map(field => field.key);
      const defaultHiddenColumns = [...this.defaultHiddenColumns].sort();
      const sortedHiddenColumns = [...hiddenColumns].sort();

      if (JSON.stringify(defaultOrder) === JSON.stringify(currentOrder)) {
        delete nextColumnOrders[this.tableKey];
      } else {
        nextColumnOrders[this.tableKey] = currentOrder;
      }
      if (JSON.stringify(sortedHiddenColumns) === JSON.stringify(defaultHiddenColumns)) {
        delete nextColumnVisibility[this.tableKey];
      } else {
        nextColumnVisibility[this.tableKey] = hiddenColumns;
      }

      await this.settingsStore.update({
        columnOrdersData: nextColumnOrders,
        columnVisibilityData: nextColumnVisibility,
      });
      this.show = false;
    },
  },
};
</script>
