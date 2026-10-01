import { readCourseMenu, writeCourseMenu } from '@/lib/coursemenu-menu-store';
import { makeFixHandlers } from '@/lib/draft-publish';

export const dynamic = 'force-dynamic';

export const { GET, POST } = makeFixHandlers(readCourseMenu, writeCourseMenu);
