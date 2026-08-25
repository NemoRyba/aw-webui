import Vue from 'vue';
import VueRouter from 'vue-router';
import pinia from './stores';
import { useAdminUiStore } from './stores/adminUi';
import { useAuthStore } from './stores/auth';
import { useSettingsStore } from './stores/settings';
import {
  isLandingRedirectPath,
  isNonAdminPathAllowed,
  resolveLandingPage,
} from './util/landingPage';

const Login = () => import('./views/Login.vue');
const FleetOverview = () => import('./views/fleet/FleetOverview.vue');
const FleetSummary = () => import('./views/fleet/FleetSummary.vue');
const FleetUsers = () => import('./views/fleet/FleetUsers.vue');
const FleetUser = () => import('./views/fleet/FleetUser.vue');
const FleetDevices = () => import('./views/fleet/FleetDevices.vue');
const FleetDevice = () => import('./views/fleet/FleetDevice.vue');

// NOTE (fork): the upstream host-centric views - Activity (/activity/:host),
// Search, Report, Trends, Graph, Alerts, Timespiral and the Query explorer -
// are no longer routed. Their nav entries were removed on 2026-08-24; the
// routes themselves are gone now, so they are unreachable by typed URL too and
// their code is no longer bundled. The .vue files are still in the tree
// (views/activity/, views/Search.vue, views/Report.vue, views/Trends.vue,
// views/Graph.vue, views/Alerts.vue, views/TimespiralView.vue,
// views/QueryExplorer.vue) so a route entry is all it takes to bring one back.
// They assume one host per server and would show misleading data in a fleet.
const Buckets = () => import('./views/Buckets.vue');
const Bucket = () => import('./views/Bucket.vue');
const Timeline = () => import('./views/Timeline.vue');
const Settings = () => import('./views/settings/Settings.vue');
const Admin = () => import('./views/admin/AdminView.vue');
const CategoryBuilder = () => import('./views/settings/CategoryBuilder.vue');
// Retained by explicit fork decision: the code stays, visibility is runtime
// configured by the admin (show_stopwatch_menu), and the guard below keeps it
// unreachable while that is off.
const Stopwatch = () => import('./views/Stopwatch.vue');
const Dev = () => import('./views/Dev.vue');
const NotFound = () => import('./views/NotFound.vue');

Vue.use(VueRouter);

const router = new VueRouter({
  routes: [
    {
      path: '/',
      component: FleetOverview,
      meta: { fullContainer: true },
    },
    { path: '/login', component: Login, meta: { public: true, authOnly: true } },
    { path: '/home', component: FleetOverview, meta: { fullContainer: true } },
    { path: '/fleet', component: FleetOverview, meta: { fullContainer: true } },
    { path: '/fleet/summary', component: FleetSummary, meta: { fullContainer: true } },
    { path: '/fleet/users', component: FleetUsers, meta: { fullContainer: true } },
    {
      path: '/fleet/users/:username',
      component: FleetUser,
      props: true,
      meta: { fullContainer: true },
    },
    { path: '/fleet/devices', component: FleetDevices, meta: { fullContainer: true } },
    {
      path: '/fleet/devices/:device_id',
      component: FleetDevice,
      props: true,
      meta: { fullContainer: true },
    },
    { path: '/buckets', component: Buckets, meta: { adminOnly: true } },
    { path: '/buckets/:id', component: Bucket, props: true, meta: { adminOnly: true } },
    { path: '/timeline', component: Timeline, meta: { fullContainer: true, adminOnly: true } },
    { path: '/settings', component: Settings, meta: { fullContainer: true, adminOnly: true } },
    { path: '/admin', component: Admin, meta: { fullContainer: true, adminOnly: true } },
    {
      path: '/settings/category-builder',
      component: CategoryBuilder,
      meta: { adminOnly: true },
    },
    // Fork override: stopwatch code is retained, but UI visibility is runtime-configured.
    { path: '/stopwatch', component: Stopwatch },
    { path: '/dev', component: Dev, meta: { adminOnly: true } },
    // NOTE: Will break with Vue 3: https://stackoverflow.com/questions/40193634/vue-router-redirect-on-page-not-found-404/64186073#64186073
    {
      path: '*',
      component: NotFound,
    },
  ],
});

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore(pinia);
  await authStore.ensureLoaded();

  if (authStore.authenticated) {
    const adminUiStore = useAdminUiStore(pinia);
    const settingsStore = useSettingsStore(pinia);
    await settingsStore.ensureLoaded();
    await adminUiStore.ensureLoaded();
    const landingPage = resolveLandingPage(settingsStore, adminUiStore, authStore);

    if (isLandingRedirectPath(to.path)) {
      next(landingPage);
      return;
    }

    if (to.path === '/login') {
      const requestedNext = typeof to.query.next === 'string' ? to.query.next : '';
      next(requestedNext && !isLandingRedirectPath(requestedNext) ? requestedNext : landingPage);
      return;
    }

    if (to.path === '/stopwatch' && !adminUiStore.showStopwatchMenu) {
      next(landingPage);
      return;
    }

    if (to.matched.some(record => record.meta && record.meta.adminOnly) && !authStore.isAdmin) {
      next(landingPage);
      return;
    }

    // Non-admins are whitelisted: their own single-user view plus pages the
    // admin explicitly granted them. EVERY other route (fleet or not) - also
    // typed directly into the URL bar - redirects to their start page.
    if (!authStore.isAdmin && !isNonAdminPathAllowed(to.path, authStore)) {
      next(landingPage);
      return;
    }

    next();
    return;
  }

  const isPublic = to.matched.some(record => record.meta && record.meta.public);
  if (isPublic) {
    next();
    return;
  }

  next({
    path: '/login',
    query: { next: to.fullPath },
  });
});

export default router;
