<template lang="pug">
div
  // TODO: Make event-editor a global component backed by a Vuex store
  //       Currently, more than one event-editor on the same view can lead to multiple event-editors opening.
  event-editor(
    v-if="editable"
    :event="editableEvent", :bucket_id="bucket_id",
    @save="(e) => $emit('save', e)", @delete="removeEvent"
  )
  b-card.event-container(no-block=true)
    div(slot="header", class="event-list-header")
      div.event-list-title
        h4.card-title {{ $tr('Events') }}
        span.pagination-header
          | {{ eventCountLabel }}
      div.event-list-actions
        b-form-checkbox(
          v-if="canSelectEvents && displayedEventIds.length > 0"
          v-model="selectDisplayed"
          :indeterminate="someDisplayedSelected && !allDisplayedSelected"
          size="sm"
        )
          | {{ $tr('Select shown') }}
        span.selected-count(v-if="canSelectEvents && selectedEventIds.length > 0")
          | {{ $tr('Selected: {count}', { count: selectedEventIds.length }) }}
        b-button(
          v-if="canSelectEvents"
          @click="deleteSelectedEvents"
          size="sm"
          variant="danger"
          :disabled="selectedEventIds.length === 0 || deletingSelected"
        )
          icon(name="trash")
          span(v-if="!deletingSelected")
            | {{ $tr('Delete selected') }}
          span(v-else)
            | {{ $tr('Deleting...') }}
        b-button(@click="expandList", size="sm", variant="outline-secondary")
          span(v-if="!isListExpanded")
            | {{ $tr('Expand list') }}
          span(v-else)
            | {{ $tr('Condense list') }}

    ul.event-list(:class="{ 'expand': isListExpanded }")
      li(v-for="event in displayed_events", :key="event.id != null ? 'event-' + event.id : event.timestamp + '-' + event.duration")
        span.event-row
          b-form-checkbox.event-select(
            v-if="canSelectEvents && event.id != null"
            v-model="selectedEventIds"
            :value="event.id"
            :aria-label="$tr('Select event')"
          )
          span.event
            span.field(:title="event.timestamp")
              icon(name="calendar")
              | {{ event.timestamp | friendlytime }}
            span.field
              icon(name="clock")
              | {{ event.duration | friendlyduration }}
            span(v-for="(val, key) in event.data").field
              icon(name="tags")
              // TODO: Add some kind of highlighting to key
              | {{ key }}: {{ val }}
            span(v-if="editable")
              b-btn.field(@click="() => {editEvent(event)}" variant="outline-dark" size="sm" style="padding: 0 0.2em 0 0.2em")
                icon(name="edit")
                | {{ $tr('Edit') }}
</template>

<style scoped lang="scss">
$border-color: #ddd;

.card {
  margin-bottom: 1em;

  .card-title {
    display: inline-block;
    margin-bottom: 0;
    margin-right: 1em;
  }

  .card-body {
    padding: 0;
  }
}

.event-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.event-list-title {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.event-list-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.selected-count {
  color: #666;
  font-size: 0.9rem;
  white-space: nowrap;
}

.event-list {
  list-style-type: none;
  padding: 0;
  border-radius: 3px;
  height: 25em;
  overflow-y: auto;
  white-space: nowrap;
  margin-bottom: 0px;

  li {
    border: 0 solid $border-color;
    border-width: 0 0 1px 0;
    border-radius: 4px;
    padding: 2px;

    &:last-child {
      border-width: 0;
    }
  }

  &.expand {
    height: 100%;
  }
}

.event-row {
  display: flex;
  align-items: flex-start;
  min-width: max-content;
}

.event-select {
  flex: 0 0 auto;
  margin: 0.55rem 0.45rem 0 0.45rem;
}

.event {
  display: inline-block;
  padding: 0.3em;
  clear: both;
}

.pagination-header {
  font-size: 12pt;
  color: #666;
  margin-bottom: 10px;
}

.field {
  margin: 0 5px 0 0;
  font-size: 11pt;
  padding: 3px 5px 3px 5px;
  background-color: #ddd;
  border: 1px solid #ccc;
  border-radius: 2px;

  &:last-child {
    margin-right: 0;
  }
}

/* Flips the outer element once, then all direct children once,
   leaving the scrollbar in the first flipped yet the content correct */
.scrollbar-flipped,
.scrollbar-flipped > * {
  transform: rotateX(180deg);
  -ms-transform: rotateX(180deg); /* IE 9 */
  -webkit-transform: rotateX(180deg); /* Safari and Chrome */
}
</style>

<script lang="ts">
import 'vue-awesome/icons/edit';
import 'vue-awesome/icons/trash';
import 'vue-awesome/icons/tags';
import 'vue-awesome/icons/clock';
import 'vue-awesome/icons/calendar';

import EventEditor from '~/components/EventEditor.vue';

export default {
  name: 'EventList',
  components: {
    'event-editor': EventEditor,
  },
  props: {
    bucket_id: String,
    events: Array,
    editable: {
      default: false,
      type: Boolean,
    },
  },
  data: function () {
    return {
      isListExpanded: false,
      limit: 100,
      editableEvent: null,
      selectedEventIds: [],
      deletingSelected: false,
    };
  },
  computed: {
    displayed_events: function () {
      return (this.events || []).slice(0, this.limit);
    },
    displayedEventIds: function () {
      return this.displayed_events
        .map(event => event.id)
        .filter(eventId => eventId !== undefined && eventId !== null);
    },
    selectedEventIdSet: function () {
      return new Set(this.selectedEventIds.map(eventId => String(eventId)));
    },
    canSelectEvents: function () {
      return this.editable && !!this.bucket_id;
    },
    allDisplayedSelected: function () {
      return (
        this.displayedEventIds.length > 0 &&
        this.displayedEventIds.every(eventId => this.selectedEventIdSet.has(String(eventId)))
      );
    },
    someDisplayedSelected: function () {
      return this.displayedEventIds.some(eventId => this.selectedEventIdSet.has(String(eventId)));
    },
    selectDisplayed: {
      get: function () {
        return this.allDisplayedSelected;
      },
      set: function (value) {
        const displayedIds = this.displayedEventIds;
        const displayedIdSet = new Set(displayedIds.map(eventId => String(eventId)));

        if (value) {
          const selectedById = new Map(
            this.selectedEventIds.map(eventId => [String(eventId), eventId])
          );
          displayedIds.forEach(eventId => selectedById.set(String(eventId), eventId));
          this.selectedEventIds = Array.from(selectedById.values());
        } else {
          this.selectedEventIds = this.selectedEventIds.filter(
            eventId => !displayedIdSet.has(String(eventId))
          );
        }
      },
    },
    eventCountLabel: function () {
      const shown = this.displayed_events.length;
      const total = (this.events || []).length;
      if (total > shown) {
        return this.$tr('Showing {shown} events (out of {total})', { shown, total });
      }
      return this.$tr('Showing {shown} events', { shown });
    },
  },
  watch: {
    events: function () {
      this.pruneSelectedEvents();
    },
  },
  methods: {
    editEvent: function (event) {
      this.editableEvent = event;
      this.$nextTick(() => {
        this.$bvModal.show('edit-modal-' + event.id);
      });
    },
    expandList: function () {
      this.isListExpanded = !this.isListExpanded;
      console.log('List should be expanding: ', this.isListExpanded);
    },
    removeEvent: function (event) {
      if (event && event.id !== undefined && event.id !== null) {
        this.selectedEventIds = this.selectedEventIds.filter(
          eventId => String(eventId) !== String(event.id)
        );
      }
      this.$emit('delete', event);
    },
    pruneSelectedEvents: function () {
      const availableIds = new Set(
        (this.events || [])
          .map(event => event.id)
          .filter(eventId => eventId !== undefined && eventId !== null)
          .map(eventId => String(eventId))
      );
      this.selectedEventIds = this.selectedEventIds.filter(eventId =>
        availableIds.has(String(eventId))
      );
    },
    deleteSelectedEvents: async function () {
      if (!this.canSelectEvents || this.selectedEventIds.length === 0) {
        return;
      }

      const eventIds = [...this.selectedEventIds];
      const confirmed = window.confirm(
        this.$tr('Delete {count} selected events? This is permanent and cannot be undone.', {
          count: eventIds.length,
        })
      );
      if (!confirmed) {
        return;
      }

      this.deletingSelected = true;
      const deletedEventIds = [];
      try {
        for (const eventId of eventIds) {
          await this.$aw.deleteEvent(this.bucket_id, eventId);
          deletedEventIds.push(eventId);
        }
      } catch (err) {
        console.error('Failed to delete selected events', err);
        window.alert(this.$tr('Failed to delete selected events. See server logs for more info.'));
      } finally {
        if (deletedEventIds.length > 0) {
          const deletedIdSet = new Set(deletedEventIds.map(eventId => String(eventId)));
          this.selectedEventIds = this.selectedEventIds.filter(
            eventId => !deletedIdSet.has(String(eventId))
          );
          this.$emit('delete-many', deletedEventIds);
        }
        this.deletingSelected = false;
      }
    },
  },
};
</script>
