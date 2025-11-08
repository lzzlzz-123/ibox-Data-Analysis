import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';

const DashboardView = () => import('@/views/DashboardView.vue');
const CollectionDetailView = () => import('@/views/CollectionDetailView.vue');
const NotFoundView = () => import('@/views/NotFoundView.vue');

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: DashboardView,
  },
  {
    path: '/collections/:collectionId',
    name: 'collection-detail',
    component: CollectionDetailView,
    props: true,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundView,
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL || '/'),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

export default router;
