import { happyhourDP } from '@/lib/happyhour-menu-store';
import { makePublishHandler } from '@/lib/draft-publish';

export const dynamic = 'force-dynamic';

export const { POST } = makePublishHandler(happyhourDP);
