import { readArwMenu, writeArwMenu } from '@/lib/arw-menu-store';
import { makeFixHandlers } from '@/lib/draft-publish';

export const dynamic = 'force-dynamic';

export const { GET, POST } = makeFixHandlers(readArwMenu, writeArwMenu);
