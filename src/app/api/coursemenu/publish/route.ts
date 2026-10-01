import { coursemenuDP } from '@/lib/coursemenu-menu-store';
import { makePublishHandler } from '@/lib/draft-publish';

export const dynamic = 'force-dynamic';

export const { POST } = makePublishHandler(coursemenuDP);
