<template lang="pug">
div.mb-3
  b-nav(pills small)
    b-nav-item(to="/fleet" exact exact-active-class="active")
      | {{ $tr('Live') }}
    b-nav-item(to="/fleet/summary" exact exact-active-class="active")
      | {{ $tr('Zusammenfassung') }}
    b-nav-item(to="/fleet/users" exact exact-active-class="active")
      | {{ $tr('Users') }}
    b-nav-item(to="/fleet/devices" exact exact-active-class="active")
      | {{ $tr('Devices') }}
</template>

<script lang="ts">
export default {
  name: 'FleetNav',
};
</script>
