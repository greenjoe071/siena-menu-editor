import { drinksdessertDP } from '@/lib/drinksdessert-menu-store';
import { makePublishHandler } from '@/lib/draft-publish';

export const dynamic = 'force-dynamic';

export const { POST } = makePublishHandler(drinksdessertDP);
