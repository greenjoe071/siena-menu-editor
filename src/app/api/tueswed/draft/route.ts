import { tueswedDP } from '@/lib/tueswed-menu-store';
import { makeDraftHandlers } from '@/lib/draft-publish';

export const dynamic = 'force-dynamic';

export const { GET, POST, DELETE } = makeDraftHandlers(tueswedDP);
