// "Fix a Mistake" reuses the exact same editor as the draft flow — the
// component detects /fix vs /edit via usePathname() and switches its data
// source, banner, and footer accordingly. See src/app/dessert/edit/page.tsx.
export { default } from '../edit/page';
