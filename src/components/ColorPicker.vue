<template lang="pug">
div.color-picker(ref="colorpicker")
  b-input-group
    b-input-group-prepend
      b-form-input.color-native-input(
        type="color"
        :value="hexColor"
        @input="updateFromNative"
        @focus="showPicker()"
        title="Pick color"
      )
    b-form-input(
      v-model.trim="colorValue"
      @focus="showPicker()"
      @input="updateFromInput"
      :state="inputState"
      placeholder="#FF00FF"
    )
    b-input-group-append
      b-button.px-2(variant="outline-secondary" @click="togglePicker()" title="Open color picker")
        div.current-color(:style="'background-color: ' + hexColor")
      b-btn.px-1(variant="outline-secondary", @click="randomColor()" title="Randomize")
        icon(name="sync" scale="1")

  div.color-picker-popover(v-if="displayPicker")
    picker(:value="colors" @input="updateFromPicker" :disable-alpha="true")
</template>

<style>
.color-picker {
  position: relative;
}

.color-native-input {
  width: 3rem;
  min-width: 3rem;
  padding: 0.15rem;
}

.color-picker-popover {
  position: absolute;
  top: calc(100% + 0.35rem);
  left: 0;
  z-index: 1051;
}

.color-picker-popover .vc-chrome {
  box-shadow: 0 0.35rem 1rem rgba(0, 0, 0, 0.24);
}

.current-color {
  border-radius: 1em;
  height: 1.5em;
  width: 1.5em;
  background-color: #000;
  cursor: pointer;
}
</style>

<script lang="ts">
import 'vue-awesome/icons/sync';

import { Chrome } from 'vue-color';

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeHexColor(color) {
  const value = String(color || '').trim();
  if (!HEX_COLOR.test(value)) {
    return null;
  }

  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toUpperCase();
  }

  return value.toUpperCase();
}

export default {
  components: {
    picker: Chrome,
  },
  props: { value: { type: String, default: '#000000' } },
  data() {
    return {
      colors: {
        hex: '#000000',
      },
      colorValue: '',
      displayPicker: false,
    };
  },
  computed: {
    hexColor() {
      return normalizeHexColor(this.colorValue) || '#000000';
    },
    inputState() {
      return normalizeHexColor(this.colorValue) ? null : false;
    },
  },
  watch: {
    colorValue(val) {
      const normalized = normalizeHexColor(val);
      if (normalized) {
        this.updateColors(normalized);
        this.$emit('input', normalized);
      }
    },
    value(val) {
      this.setColor(val);
    },
  },
  mounted() {
    this.setColor(this.value);
  },
  methods: {
    setColor(color) {
      const normalized = normalizeHexColor(color) || '#000000';
      this.updateColors(normalized);
      this.colorValue = normalized;
    },
    updateColors(color) {
      const normalized = normalizeHexColor(color);
      if (normalized) {
        this.colors = {
          hex: normalized,
        };
      }
    },
    showPicker() {
      document.addEventListener('click', this.documentClick);
      this.displayPicker = true;
    },
    hidePicker() {
      document.removeEventListener('click', this.documentClick);
      this.displayPicker = false;
    },
    togglePicker() {
      this.displayPicker ? this.hidePicker() : this.showPicker();
    },
    updateFromNative(event) {
      this.colorValue = normalizeHexColor(event?.target?.value) || this.hexColor;
    },
    updateFromInput() {
      const normalized = normalizeHexColor(this.colorValue);
      if (normalized) {
        this.updateColors(normalized);
      }
    },
    updateFromPicker(color) {
      this.colors = color;
      this.colorValue = normalizeHexColor(color.hex) || this.hexColor;
    },
    randomColor() {
      this.colorValue = `#${Math.floor(Math.random() * 0xffffff)
        .toString(16)
        .padStart(6, '0')
        .toUpperCase()}`;
    },
    documentClick(e) {
      const el = this.$refs.colorpicker;
      const target = e.target;
      if (el !== target && !el.contains(target)) {
        this.hidePicker();
      }
    },
  },
};
</script>
