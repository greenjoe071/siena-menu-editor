import { dinnerDP } from '@/lib/menu-store';
import { makeNoteHandler } from '@/lib/draft-publish';

export const dynamic = 'force-dynamic';

export const { POST } = makeNoteHandler(dinnerDP);
