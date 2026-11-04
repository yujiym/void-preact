import { expect, it } from 'vite-plus/test';
import { renderPreactPage } from '../../src/runtime/pages-server.ts';

it('rejects with the error a page throws while rendering', async () => {
  const boom = new TypeError('page render failed');
  function Page(): never {
    throw boom;
  }

  await expect(
    renderPreactPage({
      pageObj: { component: 'page', props: {}, url: '/', params: {}, shared: {}, errors: null },
      assetTags: { css: '', preloads: '', body: '' },
      components: { page: async () => ({ default: Page }) },
      layoutTree: {},
    }),
  ).rejects.toBe(boom);
});
