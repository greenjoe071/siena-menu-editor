import { coursemenuDP } from '@/lib/coursemenu-menu-store';
import { makeDraftHandlers } from '@/lib/draft-publish';

export const dynamic = 'force-dynamic';

export const { GET, POST, DELETE } = makeDraftHandlers(coursemenuDP);
