import Vue from 'vue';
import VueRouter from 'vue-router';
import pinia from './stores';
import { useAdminUiStore } from './stores/adminUi';
import { useAuthStore } from './stores/auth';

const Home = () => import('./views/Home.vue');
const Login = () => import('./views/Login.vue');
const FleetOverview = () => import('./views/fleet/FleetOverview.vue');
const FleetUsers = () => import('./views/fleet/FleetUsers.vue');
const FleetUser = () => import('./views/fleet/FleetUser.vue');
const FleetDevices = () => import('./views/fleet/FleetDevices.vue');
const FleetDevice = () => import('./views/fleet/FleetDevice.vue');

// Activity views for desktop
const Activity = () => import('./views/activity/Activity.vue');
const ActivityView = () => import('./views/activity/ActivityView.vue');

const Buckets = () => import('./views/Buckets.vue');
const Bucket = () => import('./views/Bucket.vue');
const QueryExplorer = () => import('./views/QueryExplorer.vue');
const Timeline = () => import('./views/Timeline.vue');
const Trends = () => import('./views/Trends.vue');
const Settings = () => import('./views/settings/Settings.vue');
const CategoryBuilder = () => import('./views/settings/CategoryBuilder.vue');
const Stopwatch = () => import('./views/Stopwatch.vue');
const Alerts = () => import('./views/Alerts.vue');
const Search = () => import('./views/Search.vue');
const Report = () => import('./views/Report.vue');
const TimespiralView = () => import('./views/TimespiralView.vue');
const Dev = () => import('./views/Dev.vue');
const Graph = () => import('./views/Graph.vue');
const NotFound = () => import('./views/NotFound.vue');

Vue.use(VueRouter);

const router = new VueRouter({
  routes: [
    {
      path: '/',
      redirect: _to => {
        return localStorage.landingpage || '/home';
      },
    },
    { path: '/login', component: Login, meta: { public: true, authOnly: true } },
    { path: '/home', component: Home },
    { path: '/fleet', component: FleetOverview },
    { path: '/fleet/users', component: FleetUsers },
    { path: '/fleet/users/:username', component: FleetUser, props: true },
    { path: '/fleet/devices', component: FleetDevices },
    { path: '/fleet/devices/:device_id', component: FleetDevice, props: true },
    {
      path: '/activity/:host/:periodLength?/:date?',
      component: Activity,
      props: true,
      children: [
        {
          path: 'view/:view_id?',
          meta: { subview: 'view' },
          name: 'activity-view',
          component: ActivityView,
          props: true,
        },
        // Unspecified should redirect to summary view is the summary view
        // (needs to be last since otherwise it'll always match first)
        {
          path: '',
          redirect: 'view/',
        },
      ],
    },
    { path: '/buckets', component: Buckets },
    { path: '/buckets/:id', component: Bucket, props: true },
    { path: '/timeline', component: Timeline, meta: { fullContainer: true } },
    { path: '/trends', component: Trends, meta: { fullContainer: true } },
    { path: '/trends/:host', component: Trends, meta: { fullContainer: true } },
    { path: '/report', component: Report },
    { path: '/query', component: QueryExplorer },
    { path: '/alerts', component: Alerts },
    { path: '/timespiral', component: TimespiralView },
    { path: '/settings', component: Settings },
    { path: '/settings/category-builder', component: CategoryBuilder },
    // Fork override: stopwatch code is retained, but UI visibility is runtime-configured.
    { path: '/stopwatch', component: Stopwatch },
    { path: '/search', component: Search },
    { path: '/graph', component: Graph },
    { path: '/dev', component: Dev },
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
    await adminUiStore.ensureLoaded();

    if (to.path === '/login') {
      next(
        (typeof to.query.next === 'string' && to.query.next) || localStorage.landingpage || '/home'
      );
      return;
    }

    if (to.path === '/stopwatch' && !adminUiStore.showStopwatchMenu) {
      next(localStorage.landingpage || '/home');
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
