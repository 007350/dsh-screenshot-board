import { join } from 'node:path';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
import { BoardStore } from './storage.js';
import { createHandler, ROUTE_PREFIX } from './router.js';
export const name = 'dsh-screenshot-board';
export const inject = ['webServer'];
export function apply(ctx, config) {
  const store = new BoardStore(join(resolveDshHome(), 'dsh-screenshot-board'));
  const handler = createHandler({ store, log: ctx.logger || console });
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: ROUTE_PREFIX, handler }), 'dsh-screenshot-board: local board API');
}
