/**
 * Siena Private Dining Menu — renderer.
 *
 * Ported from the designer's framework-agnostic reference functions
 * (extraItemCount, shrinkTier, TIER_FONT_SIZES, courseListMarginTop,
 * mergeCourseDishes are preserved verbatim from their handoff) into an
 * actual render(document, data) DOM function, matching the pattern every
 * other menu in this app uses.
 *
 * `data` shape expected by render():
 *   {
 *     eventTitle: string,
 *     eventDate: string,
 *     logoUrl: string | null,        // data URL or /images/... path, or null
 *     extraCount: 0 | 1 | 2,         // drives tier + warning note
 *     courses: [ { label: string, dishes: [ { name: string, desc?: string } ] } ]
 *   }
 * `courses` must already have any extraItems merged in (see mergeCourseDishes) —
 * render() itself does not know about alternates, only the final dish list.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SienaPrivateDiningRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Cap: an alternate may carry at most 2 extra items TOTAL across all its courses (not per-course). */
  var MAX_EXTRA_ITEMS = 2;

  /** @param {{extraItems: Array}} alternate */
  function extraItemCount(alternate) {
    return (alternate && alternate.extraItems && alternate.extraItems.length) || 0;
  }

  /** Tier 0 = 0 extra items. Tier 1 = exactly 1. Tier 2 = 2 (the cap). */
  function shrinkTier(extraCount) {
    if (extraCount <= 0) return 0;
    if (extraCount === 1) return 1;
    return 2;
  }

  /** Exact type sizes per tier — also baked into template.html's CSS; kept here for tests/reference. */
  var TIER_FONT_SIZES = {
    0: { dishNamePx: 20, dishDescPx: 14 },
    1: { dishNamePx: 18, dishDescPx: 12.5 },
    2: { dishNamePx: 16, dishDescPx: 11.5 }
  };

  /** @param {boolean} titleWrapped */
  function courseListMarginTop(titleWrapped) {
    return titleWrapped ? 14 : 24;
  }

  /** Merge a course's base dishes with any extras targeting it, base first, extras in add order. */
  function mergeCourseDishes(course, extraItems, courseIndex) {
    var extras = (extraItems || []).filter(function (e) { return e.courseIndex === courseIndex; });
    return course.dishes.concat(extras);
  }

  /** Build the final `courses` array render() expects, given a menu + a selected alternate (or null). */
  function buildCourses(menu, alternate) {
    var extraItems = alternate ? alternate.extraItems : [];
    return menu.courses.map(function (course, idx) {
      return { label: course.label, dishes: mergeCourseDishes(course, extraItems, idx) };
    });
  }

  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  function render(document, data) {
    var page = document.querySelector('.menu-page');
    var extraCount = data.extraCount || 0;
    var tier = shrinkTier(extraCount);

    page.dataset.tier = String(tier);
    page.dataset.extraCount = String(extraCount);
    page.classList.remove('title-wrapped'); // re-measured by applyTitleWrapAdjustment()

    // Logo — fixed 64x64 slot, empty when no logo (no placeholder graphic on the printed page).
    var logoSlot = page.querySelector('.logo-slot');
    clear(logoSlot);
    if (data.logoUrl) {
      var img = document.createElement('img');
      img.src = data.logoUrl;
      img.alt = '';
      logoSlot.appendChild(img);
    }

    page.querySelector('.event-title').textContent = data.eventTitle || '';
    page.querySelector('.event-date').textContent = data.eventDate || '';

    var courseList = page.querySelector('.course-list');
    Array.prototype.slice.call(courseList.querySelectorAll('.course-group')).forEach(function (el) {
      el.remove();
    });

    var courseGroupTpl = document.getElementById('course-group-template');
    var dishTpl = document.getElementById('dish-template');

    (data.courses || []).forEach(function (course) {
      var groupFrag = courseGroupTpl.content
        ? courseGroupTpl.content.cloneNode(true)
        : document.importNode(courseGroupTpl.content, true);
      var groupEl = groupFrag.querySelector('.course-group');
      groupEl.querySelector('.course-label').textContent = course.label;

      course.dishes.forEach(function (dish) {
        var dishFrag = dishTpl.content
          ? dishTpl.content.cloneNode(true)
          : document.importNode(dishTpl.content, true);
        var dishEl = dishFrag.querySelector('.dish');
        dishEl.querySelector('.dish-name').textContent = dish.name;
        var descEl = dishEl.querySelector('.dish-desc');
        if (dish.desc) {
          descEl.textContent = dish.desc;
        } else {
          descEl.remove();
        }
        groupEl.appendChild(dishEl);
      });

      courseList.appendChild(groupEl);
    });
  }

  /**
   * Real-browser-only: measures the rendered .event-title's height against a
   * single line's height. If it wrapped to 2 lines, toggles `.title-wrapped`
   * on .menu-page, which collapses .course-list's margin-top from 24px to
   * 14px via CSS already baked into template.html. JSDOM cannot compute real
   * text layout, so this must run in the preview iframe or the print window,
   * never in the server-side JSDOM renderer (same constraint as validate.js).
   */
  function applyTitleWrapAdjustment(document) {
    var page = document.querySelector('.menu-page');
    var title = page && page.querySelector('.event-title');
    if (!page || !title) return false;
    var win = document.defaultView || window;
    var cs = win.getComputedStyle(title);
    var lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25;
    var wrapped = title.getBoundingClientRect().height > lineHeight * 1.4;
    page.classList.toggle('title-wrapped', wrapped);
    return wrapped;
  }

  return {
    MAX_EXTRA_ITEMS: MAX_EXTRA_ITEMS,
    extraItemCount: extraItemCount,
    shrinkTier: shrinkTier,
    TIER_FONT_SIZES: TIER_FONT_SIZES,
    courseListMarginTop: courseListMarginTop,
    mergeCourseDishes: mergeCourseDishes,
    buildCourses: buildCourses,
    render: render,
    applyTitleWrapAdjustment: applyTitleWrapAdjustment
  };
});
