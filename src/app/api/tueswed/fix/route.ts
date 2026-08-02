import { readTuewedMenu, writeTuewedMenu } from '@/lib/tueswed-menu-store';
import { makeFixHandlers } from '@/lib/draft-publish';

export const dynamic = 'force-dynamic';

export const { GET, POST } = makeFixHandlers(readTuewedMenu, writeTuewedMenu);
