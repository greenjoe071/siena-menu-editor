import { readHappyhourMenu, writeHappyhourMenu } from '@/lib/happyhour-menu-store';
import { makeFixHandlers } from '@/lib/draft-publish';

export const dynamic = 'force-dynamic';

export const { GET, POST } = makeFixHandlers(readHappyhourMenu, writeHappyhourMenu);
