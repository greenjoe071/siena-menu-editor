import { readWeekendMenu, writeWeekendMenu } from '@/lib/weekend-menu-store';
import { makeFixHandlers } from '@/lib/draft-publish';

export const dynamic = 'force-dynamic';

export const { GET, POST } = makeFixHandlers(readWeekendMenu, writeWeekendMenu);
