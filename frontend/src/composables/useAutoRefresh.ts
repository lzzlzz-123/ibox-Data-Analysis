import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

interface AutoRefreshOptions {
  interval?: number;
  immediate?: boolean;
}

type RefreshHandler = () => void | Promise<void>;

type AutoRefreshReturn = {
  start: () => void;
  stop: () => void;
  trigger: () => Promise<void>;
  isActive: () => boolean;
};

export function useAutoRefresh(handler: RefreshHandler, options: AutoRefreshOptions = {}): AutoRefreshReturn {
  const interval = options.interval ?? 60_000;
  const timerId = ref<number | null>(null);
  const isRefreshing = ref(false);
  const route = useRoute();

  async function executeHandler() {
    if (isRefreshing.value) {
      return;
    }
    try {
      isRefreshing.value = true;
      await handler();
    } finally {
      isRefreshing.value = false;
    }
  }

  function start() {
    if (timerId.value !== null) {
      return;
    }
    timerId.value = window.setInterval(() => {
      void executeHandler();
    }, interval);
  }

  function stop() {
    if (timerId.value !== null) {
      window.clearInterval(timerId.value);
      timerId.value = null;
    }
  }

  async function trigger() {
    await executeHandler();
  }

  const isActive = () => timerId.value !== null;

  onMounted(() => {
    if (options.immediate) {
      void executeHandler();
    }
    start();
  });

  watch(
    () => route.fullPath,
    () => {
      stop();
    }
  );

  onBeforeUnmount(() => {
    stop();
  });

  return {
    start,
    stop,
    trigger,
    isActive,
  };
}
