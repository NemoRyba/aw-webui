<template lang="pug">
div
  h3 Search

  b-alert(style="warning" show)
    | This feature is still in early development.

  b-alert(v-if="error" show variant="danger")
    | {{error}}

  b-input-group(size="lg")
    b-input(v-model="pattern" v-on:keyup.enter="search()" placeholder="Regex pattern to search for")
    b-input-group-append
      b-button(type="button", @click="search()" variant="success")
        icon(name="search")
        | Search

  div.d-flex.mt-1
    div.mr-auto.small(style="color: #666")
      div Selection: {{ querySelectionLabel }}
      div(v-if="queryOptions.hostname") Hostname: {{ queryOptions.hostname }}
    b-button.border-0(size="sm", variant="outline-dark" @click="show_options = !show_options")
      span(v-if="!show_options")
        | #[icon(name="angle-double-down")] Show options
      span(v-else)
        | #[icon(name="angle-double-up")] Hide options

  div(v-show="show_options")
    h4 Options
    aw-query-options(v-model="queryOptions")

  div(v-if="status == 'searching'")
    div #[icon(name="spinner" pulse)] Searching...

  div(v-if="events != null")
    hr

    aw-selectable-eventview(:events="events")

    div
      | Didn't find what you were looking for?
      br
      | Add a week to the search: #[b-button(size="sm" variant="outline-dark" @click="start = start.subtract(1, 'week'); search()") +1 week]
</template>

<script lang="ts">
import _ from 'lodash';
import moment from 'moment';
import { canonicalEvents } from '~/queries';

import 'vue-awesome/icons/search';
import 'vue-awesome/icons/spinner';
import 'vue-awesome/icons/angle-double-down';
import 'vue-awesome/icons/angle-double-up';

export default {
  name: 'Search',
  data() {
    return {
      pattern: '',
      events: null,

      status: null,
      error: '',

      // Options
      show_options: false,
      queryOptions: {
        start: moment().subtract(1, 'day'),
        stop: moment().add(1, 'day'),
      },
    };
  },
  computed: {
    querySelectionLabel() {
      const parts = [];
      if (this.queryOptions.username) {
        parts.push(this.queryOptions.username);
      }
      if (this.queryOptions.device_name) {
        parts.push(this.queryOptions.device_name);
      }
      if (this.queryOptions.session_id) {
        parts.push(
          `Session ${this.queryOptions.session_id}${
            this.queryOptions.session_type ? ` (${this.queryOptions.session_type})` : ''
          }`
        );
      }
      if (parts.length === 0 && this.queryOptions.hostname) {
        parts.push(this.queryOptions.hostname);
      }
      return parts.join(' | ') || 'No watcher session selected';
    },
  },
  methods: {
    search: async function () {
      if (!this.queryOptions.bid_window || !this.queryOptions.bid_afk) {
        this.events = null;
        this.error = 'No matching window/AFK watcher pair is selected.';
        return;
      }

      let query = canonicalEvents({
        bid_window: this.queryOptions.bid_window,
        bid_afk: this.queryOptions.bid_afk,
        filter_afk: this.queryOptions.filter_afk,
        categories: [[['searched'], { type: 'regex', regex: this.pattern }]],
        filter_categories: [['searched']],
      });
      query += '; RETURN = events;';

      const query_array = query.split(';').map(s => s.trim() + ';');
      const timeperiods = [
        moment(this.queryOptions.start).format() + '/' + moment(this.queryOptions.stop).format(),
      ];
      try {
        this.status = 'searching';
        const data = await this.$aw.query(timeperiods, query_array);
        this.events = _.orderBy(data[0], ['timestamp'], ['desc']);
        this.error = '';
      } catch (e) {
        console.error(e);
        this.error = e.response.data.message;
      } finally {
        this.status = null;
      }
    },
  },
};
</script>
