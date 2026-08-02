import { drinksdessertDP } from '@/lib/drinksdessert-menu-store';
import { makeNoteHandler } from '@/lib/draft-publish';

export const dynamic = 'force-dynamic';

export const { POST } = makeNoteHandler(drinksdessertDP);
