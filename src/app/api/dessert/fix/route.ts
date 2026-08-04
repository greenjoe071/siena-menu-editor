import { readDessertMenu, writeDessertMenu } from '@/lib/dessert-menu-store';
import { makeFixHandlers } from '@/lib/draft-publish';

export const dynamic = 'force-dynamic';

export const { GET, POST } = makeFixHandlers(readDessertMenu, writeDessertMenu);
