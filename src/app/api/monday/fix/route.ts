import { readMondayMenu, writeMondayMenu } from '@/lib/monday-menu-store';
import { makeFixHandlers } from '@/lib/draft-publish';

export const dynamic = 'force-dynamic';

export const { GET, POST } = makeFixHandlers(readMondayMenu, writeMondayMenu);
