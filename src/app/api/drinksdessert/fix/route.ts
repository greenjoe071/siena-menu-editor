import { readDrinksDessertMenu, writeDrinksDessertMenu } from '@/lib/drinksdessert-menu-store';
import { makeFixHandlers } from '@/lib/draft-publish';

export const dynamic = 'force-dynamic';

export const { GET, POST } = makeFixHandlers(readDrinksDessertMenu, writeDrinksDessertMenu);
