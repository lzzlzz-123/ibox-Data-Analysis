import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

vi.mock('echarts', () => {
  const dispose = vi.fn();
  const setOption = vi.fn();
  const resize = vi.fn();
  return {
    init: vi.fn(() => ({ dispose, setOption, resize })),
  };
});

import TrendChart from '@/components/TrendChart.vue';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TrendChart', () => {
  it('renders empty state when no data is provided', async () => {
    const wrapper = mount(TrendChart, {
      props: {
        title: 'Test Chart',
        series: [
          {
            name: 'Price',
            data: [],
          },
        ],
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('No data available for the selected range.');
  });

  it('renders chart container when data exists', async () => {
    const wrapper = mount(TrendChart, {
      props: {
        title: 'Chart with Data',
        series: [
          {
            name: 'Price',
            data: [
              { timestamp: '2023-01-01T00:00:00Z', price: 1, volume: null },
            ],
          },
        ],
      },
    });

    await flushPromises();

    expect(wrapper.find('.chart').exists()).toBe(true);
  });
});
