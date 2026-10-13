import { dinnerDP } from '@/lib/menu-store';
import { makeDraftHandlers } from '@/lib/draft-publish';

export const dynamic = 'force-dynamic';

// Same shared handlers as every other menu (Oct 2026): GET reads the draft
// (seeded from the active menu if none), POST autosaves with blanks allowed,
// DELETE discards (a version is kept first). Also ?history / ?snapshot /
// ?restore for Earlier Versions.
export const { GET, POST, DELETE } = makeDraftHandlers(dinnerDP);
