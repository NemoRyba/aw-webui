<template lang="pug">
div.d-inline-block
  b-button(size="sm" variant="outline-secondary" @click="open")
    | {{ $tr('Columns') }}

  b-modal(
    v-model="show"
    size="sm"
    :title="$tr('Reorder columns')"
    hide-footer
    @show="resetLocalFields"
  )
    div.small.text-muted.mb-3
      | {{ $tr('Drag columns to change the order') }}

    draggable(v-model="localFields" handle=".drag-handle")
      div.d-flex.align-items-center.justify-content-between.border.rounded.px-3.py-2.mb-2(
        v-for="field in localFields"
        :key="field.key"
      )
        span.drag-handle.mr-3(style="cursor: grab; user-select: none;")
          | ≡
        span.flex-grow-1
          | {{ field.label || field.key }}

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
      this.localFields = this.orderedFields.map(field => ({
        key: field.key,
        label: field.label,
      }));
    },
    resetOrder() {
      this.localFields = this.fields.map(field => ({
        key: field.key,
        label: field.label,
      }));
    },
    async save() {
      const nextColumnOrders = {
        ...(this.settingsStore.columnOrdersData || {}),
      };
      const defaultOrder = this.fields.map(field => field.key);
      const currentOrder = this.localFields.map(field => field.key);

      if (JSON.stringify(defaultOrder) === JSON.stringify(currentOrder)) {
        delete nextColumnOrders[this.tableKey];
      } else {
        nextColumnOrders[this.tableKey] = currentOrder;
      }

      await this.settingsStore.update({
        columnOrdersData: nextColumnOrders,
      });
      this.show = false;
    },
  },
};
</script>
