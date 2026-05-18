# Siena Menu Editor — Joe's Guide

*For when you haven't touched this in a while and need a quick reminder.*

---

## What Is This?

A private web app for editing and printing Siena's menus. You make changes in the editor, it auto-saves, and you print a fresh PDF right from the app. The layouts are locked and always look exactly right — you just fill in the fields.

**The app:** https://siena-menu-editor.netlify.app
**Keep the URL private** — there's no login, so anyone with the link can edit.

---

## What Each Menu Does

| Card | What It's For |
|---|---|
| 🍽️ Dinner Menu | The main dinner menu — dishes, descriptions, prices across all sections |
| 🍹 Happy Hour | HH specials strip, small plates, cocktails (HH + regular prices), wine, beer, bar promo |
| 🍝 Monday $26 Specials | Monday night prix-fixe — hero block, two courses, weekly specials grid |
| ✨ Tue–Wed $45 Specials | Tuesday and Wednesday prix-fixe — three courses + optional add-on |
| 🌅 Weekend Specials | Thu–Sat chef's specials — changes every week, has a "New Week" button |
| 📋 Coming Soon | Reserved for a future menu |

---

## How It Works

1. Click a card on the home screen
2. Edit the fields on the left — it auto-saves as you type
3. The preview on the right updates live
4. When it looks good, click **Print Menu** in the bottom corner

**Mistakes are easy to fix** — scroll down to "Save history" in any editor to restore a previous version. Up to 10 saves are kept per menu.

---

## The Team: Claude Code + Claude Design

### Claude Code *(that's me — what you're reading this in)*

I build and maintain the app. I write all the code, handle git, and deploy to Netlify. You never need to run commands yourself — just click **Allow** when the permission dialog appears.

**When you come back after a break**, just say something like:
> *"Catch me up on the menu editor — what do we have and what can I ask you to do?"*

I'll read the project memory and give you a plain-English rundown of where everything stands.

### Claude Design *(the designer)*

Claude Design handles everything visual — menu layouts, fonts, spacing, print formatting. The files it produces are **master files** and are never edited by hand. When something needs to look different — a new section, a layout change, a whole new menu — we go to Claude Design for a new handoff package.

**Claude Design is at:** claude.ai (start a conversation and mention you're working on Siena Ristorante — it already knows the project)

> **Think of it this way:** Claude Design owns the look. Claude Code builds and runs the app. You direct both of them.

---

## Getting a Handoff from Claude Design

When you need Claude Design to update a layout or build something new, ask Claude Code first — it will write you the exact prompt to paste over there. Or use this template and fill in the brackets:

---

*I need a handoff package for the Siena Menu Editor. [Describe what needs to change — e.g. "Add a mocktails section to Happy Hour" or "Build a new Lunch menu from scratch."]*

*Please deliver a ZIP with these files:*
- `template.html` — the HTML layout
- `render.js` — UMD renderer (global name: `Siena[Name]Render`, e.g. `SienaHappyhourRender`)
- `expected-render.html` — snapshot baseline rendered from the seed data
- `menu-data.json` — complete seed data in the exact JSON shape the renderer reads
- `snapshot-test.spec.js` — same format as the existing tests in this project
- `BUILD-SPEC.md` — every editable field, character limits, section counts, what's static

*If this menu uses the layout-budget validation model (like Happy Hour v2), also include `validate.js`.*

*The renderer must export via UMD. If using the layout-budget model, descriptions should be allowed to wrap freely.*

---

Then bring the ZIP back to Claude Code and say: *"Claude Design sent a new handoff — here's the ZIP."* Claude Code handles everything from there.

---

## A Note on Editing Rules — Two Different Systems

The menus use two different approaches to keeping edits from breaking the layout:

### The Old Way *(Dinner, Monday, Weekend, Tue–Wed)*

Each field has a hard character limit. Type too much and the app blocks you from saving. This keeps the layout safe but can be frustrating when a manager wants to write a slightly longer description or add something that doesn't quite fit the limit.

### The Happy Hour Way *(layout-budget model)*

Instead of counting characters, the app measures whether the whole printed page still fits. That means:

- A description can be 1 line or 2 lines — whatever makes sense for that item
- You can make one item shorter to give another item more room
- Managers have more freedom to write naturally
- If anything overflows, you get a clear warning and the save pauses until it fits again

**This is worth considering for the other menus.** The Happy Hour model was built specifically because the old character limits were too rigid — managers would want to change a one-line description to two lines, or swap a long description for a short one, and the hard limits made that painful. The layout-budget model allows all of that while still protecting the design.

When you're ready, bring it up — say something like: *"I want to convert the Dinner menu to the Happy Hour validation model"* and Claude Code + Claude Design can work out a plan.

---

## Things You Can Ask Claude Code to Do

- *"Catch me up — what menus do we have and what's the status?"*
- *"Claude Design sent a new handoff ZIP — here's the file"*
- *"Something looks broken on the Weekend preview"*
- *"I want to add a new menu card for [lunch / brunch / etc.]"*
- *"Change the icon / label on one of the cards"*
- *"The Happy Hour prices changed — walk me through updating them"*
- *"I want to convert [menu] to the Happy Hour editing model"*
- *"Write me a prompt to take to Claude Design for [change]"*
- *"Restore the menu editor to how it looked last Tuesday"*

---

## What NOT to Do

- **Don't share the app URL publicly** — no login means anyone with the link can edit
- **Don't try to edit the design files** — `template.html`, `render.js`, and similar files are locked. All visual changes go through Claude Design.
- **Don't worry about git, deploys, or code** — Claude Code handles all of it. You just click Allow.

---

## Status at Last Update *(May 2026)*

- ✅ All 5 menus live and working
- ⏳ Weekend Specials: dessert section in progress — Claude Design prompt sent, waiting for ZIP
- ⏳ One "Coming Soon" slot on the home screen, open for a future menu
