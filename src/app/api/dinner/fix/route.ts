import { readMenu, writeMenu, dinnerDP } from '@/lib/menu-store';
import { makeFixHandlers } from '@/lib/draft-publish';

export const dynamic = 'force-dynamic';

export const { GET, POST } = makeFixHandlers(readMenu, writeMenu, dinnerDP);
