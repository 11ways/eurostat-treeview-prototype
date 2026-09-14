/* ==========================================================================
   Accessible multi-select treeview - prototype behaviour

   Implements the WAI-ARIA Authoring Practices Guide "Tree View" pattern
   (https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) for a multi-select tree
   that uses aria-checked with the three values true / false / mixed.

   Design rules that the rest of this file assumes:
     - The markup in index.html is the source of truth. Nothing is generated
       here; this script only reads and updates ARIA state.
     - Exactly one treeitem has tabindex="0" at any moment (roving tabindex).
       Tab therefore enters and leaves the whole tree, it never steps between
       nodes.
     - A parent node's aria-checked value is always derived from its direct
       children; it is never set independently.
     - Every write of aria-checked goes through setCheckedState(), which also
       maintains the visually hidden state span that carries the depth and the
       checked state into the accessible name ("level 3, not checked") - a
       VoiceOver fallback, see the comment above setCheckedState().
     - The visible status paragraph is a polite live region; it is updated once
       per settled change, not once per node touched by a cascade. It counts
       leaf nodes only - 20 selectable regions, not the 27 nodes in the tree.

   Written as an IIFE with a classic <script src> so that it also runs from a
   file:// URL, where module scripts are blocked in some browsers.
   ========================================================================== */

(function () {
  'use strict';

  var TYPEAHEAD_RESET_MS = 500;
  var STATUS_DEBOUNCE_MS = 300;

  var tree = document.getElementById('region-tree');
  var statusEl = document.getElementById('tree-status');
  if (!tree || !statusEl) {
    return;
  }

  /* ------------------------------------------------------------- helpers -- */

  function toArray(list) {
    return Array.prototype.slice.call(list);
  }

  /** All treeitems in the tree, in DOM order (regardless of visibility). */
  function allItems() {
    return toArray(tree.querySelectorAll('[role="treeitem"]'));
  }

  /** Direct treeitem children of the tree root. */
  function rootItems() {
    return toArray(tree.children).filter(function (el) {
      return el.getAttribute('role') === 'treeitem';
    });
  }

  /** The element with a given role that is a direct child of `el`. */
  function directChildrenByRole(el, role) {
    return toArray(el.children).filter(function (child) {
      return child.getAttribute('role') === role;
    });
  }

  /** The <ul role="group"> directly inside a treeitem, or null. */
  function childGroup(item) {
    var groups = directChildrenByRole(item, 'group');
    return groups.length ? groups[0] : null;
  }

  /** Direct child treeitems of a treeitem. */
  function childItems(item) {
    var group = childGroup(item);
    return group ? directChildrenByRole(group, 'treeitem') : [];
  }

  /** A leaf is a node with no child treeitems - an actual selectable region. */
  function isLeaf(item) {
    return childItems(item).length === 0;
  }

  /**
   * Only leaves are counted in the status line. Parent nodes are grouping
   * nodes: "Belgium" is not an eleventh region on top of its ten provinces,
   * and counting it would make the total (27) disagree with what a user can
   * actually select (20).
   */
  function leafItems() {
    return allItems().filter(isLeaf);
  }

  /** The treeitem that owns this one, or null for a root node. */
  function parentItem(item) {
    var container = item.parentElement;
    return container ? container.closest('[role="treeitem"]') : null;
  }

  /** The row <span> of this treeitem (not of a descendant). */
  function ownRow(item) {
    return toArray(item.children).filter(function (child) {
      return child.classList && child.classList.contains('tree__row');
    })[0] || null;
  }

  /** The label text of this treeitem, i.e. its accessible name. */
  function labelOf(item) {
    var row = ownRow(item);
    var label = row ? row.querySelector('.tree__label') : null;
    return label ? label.textContent.trim() : '';
  }

  function isExpandable(item) {
    return item.hasAttribute('aria-expanded');
  }

  function isExpanded(item) {
    return item.getAttribute('aria-expanded') === 'true';
  }

  /**
   * A node is visible when it is not hidden by the filter and every ancestor
   * is expanded and not hidden either. The hidden attribute is what the
   * filter writes; it removes the node from the accessibility tree as well.
   */
  function isVisibleItem(item) {
    if (item.hidden) {
      return false;
    }
    var ancestor = parentItem(item);
    while (ancestor) {
      if (ancestor.hidden || !isExpanded(ancestor)) {
        return false;
      }
      ancestor = parentItem(ancestor);
    }
    return true;
  }

  /** All visible treeitems in DOM order - the list arrow keys navigate. */
  function visibleItems() {
    return allItems().filter(isVisibleItem);
  }

  /* ------------------------------------------------------------- focus ---- */

  function setFocus(item) {
    allItems().forEach(function (other) {
      other.setAttribute('tabindex', other === item ? '0' : '-1');
    });
    item.focus();
  }

  /* --------------------------------------------------------- expansion ---- */

  function setExpanded(item, open) {
    if (isExpandable(item)) {
      item.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  }

  /**
   * The "*" command: expand every sibling of the focused node that has
   * children, without moving focus.
   */
  function expandSiblings(item) {
    var parent = parentItem(item);
    var siblings = parent ? childItems(parent) : rootItems();
    siblings.forEach(function (sibling) {
      setExpanded(sibling, true);
    });
  }

  /* ---------------------------------------------------------- checking ---- */

  var STATE_TEXT = {
    'true': 'checked',
    'false': 'not checked',
    'mixed': 'partially selected'
  };

  /**
   * The visually hidden state span of a treeitem: the second id listed in its
   * aria-labelledby, after the visible label.
   */
  function stateSpanOf(item) {
    var ids = (item.getAttribute('aria-labelledby') || '').split(/\s+/);
    return ids.length > 1 ? document.getElementById(ids[1]) : null;
  }

  /**
   * The text the hidden span carries for a given state, e.g.
   * ", level 3, not checked". Comma-prefixed and comma-separated so that it
   * reads with speech pauses after the visible label.
   */
  function stateTextFor(item, state) {
    var parts = [];
    var level = item.getAttribute('aria-level');
    if (level) {
      parts.push('level ' + level);
    }
    parts.push(STATE_TEXT[state] || STATE_TEXT['false']);
    return ', ' + parts.join(', ');
  }

  /**
   * Single place where aria-checked is written.
   *
   * Manual testing with VoiceOver + Safari on 14 September 2026 showed that
   * VoiceOver announces neither aria-checked changes on role="treeitem" (not
   * even plain true / false, let alone "mixed" - see the history of WebKit bug
   * 218316) nor aria-level. Pressing Space produced no audible state change at
   * all. aria-posinset / aria-setsize, on the other hand, are announced fine,
   * so the "1 of 5" part is left to the platform.
   *
   * Everything VoiceOver does not announce is therefore mirrored into a
   * visually hidden span that is part of the accessible name via
   * aria-labelledby, because name text is read reliably by all three target
   * screen readers regardless of their ARIA state support. The name becomes
   * "Antwerp, level 3, not checked", which VoiceOver rounds off with its own
   * "1 of 5".
   *
   * NVDA and JAWS may well announce aria-checked and aria-level correctly - not
   * yet verified - and would then say the state twice. That redundancy is
   * accepted on purpose: the project's rule, already applied to the mixed state
   * before, is that a state going completely unannounced is far worse than one
   * announced twice.
   *
   * The span is aria-hidden="true" in the markup (see the comment in
   * index.html): it must contribute text to the name, but never be an
   * accessible object of its own that a screen reader's reading cursor can
   * land on. This function only ever writes its textContent and must not
   * touch that attribute.
   */
  function setCheckedState(item, state) {
    item.setAttribute('aria-checked', state);
    var span = stateSpanOf(item);
    if (span) {
      var text = stateTextFor(item, state);
      if (span.textContent !== text) {
        span.textContent = text;
      }
    }
  }

  /** Set this node and every descendant to checked or unchecked. */
  function setSubtreeChecked(item, checked) {
    setCheckedState(item, checked ? 'true' : 'false');
    childItems(item).forEach(function (child) {
      setSubtreeChecked(child, checked);
    });
  }

  /**
   * Recompute every ancestor of `item` from its direct children:
   * all children checked -> true, none checked -> false, otherwise mixed.
   * A child that is itself "mixed" makes its parent "mixed" as well.
   */
  function refreshAncestors(item) {
    var ancestor = parentItem(item);
    while (ancestor) {
      var children = childItems(ancestor);
      var allChecked = children.every(function (child) {
        return child.getAttribute('aria-checked') === 'true';
      });
      var noneChecked = children.every(function (child) {
        return child.getAttribute('aria-checked') === 'false';
      });
      setCheckedState(
        ancestor,
        allChecked ? 'true' : noneChecked ? 'false' : 'mixed'
      );
      ancestor = parentItem(ancestor);
    }
  }

  /**
   * Space / Enter / click. A node that is fully checked becomes unchecked;
   * an unchecked or partially checked node becomes fully checked. The whole
   * cascade happens synchronously, then the status is scheduled once.
   */
  function toggleChecked(item) {
    var nextState = item.getAttribute('aria-checked') !== 'true';
    setSubtreeChecked(item, nextState);
    refreshAncestors(item);
    scheduleStatus();
  }

  /* ------------------------------------------------- status live region ---- */

  // Leaves only: 20 selectable regions, not the 27 nodes in the tree.
  var totalItems = leafItems().length;
  var statusTimer = null;

  function renderStatus() {
    var selected = leafItems().filter(function (item) {
      return item.getAttribute('aria-checked') === 'true';
    }).length;
    var text = 'Selected: ' + selected + ' of ' + totalItems + ' regions';
    // Only touch the DOM when the text really changed, otherwise some screen
    // readers announce the live region again for an identical value.
    if (statusEl.textContent.trim() !== text) {
      statusEl.textContent = text;
    }
    var summary = document.getElementById('region-summary');
    if (summary) {
      summary.textContent = selected + ' of ' + totalItems + ' selected';
    }
  }

  /**
   * Coalesce rapid changes into a single announcement. Checking a whole
   * country touches up to 13 nodes; holding Space walks through many nodes.
   * Either way the live region is written once, after things settle.
   */
  function scheduleStatus() {
    if (statusTimer !== null) {
      clearTimeout(statusTimer);
    }
    statusTimer = setTimeout(function () {
      statusTimer = null;
      renderStatus();
      if (currentFilter() !== 'all') {
        applyFilter();
      }
    }, STATUS_DEBOUNCE_MS);
  }

  /* ---------------------------------------------------------- type-ahead -- */

  var typeBuffer = '';
  var typeTimer = null;

  function findByPrefix(list, startIndex, prefix) {
    for (var offset = 1; offset <= list.length; offset += 1) {
      var candidate = list[(startIndex + offset) % list.length];
      if (labelOf(candidate).toLowerCase().indexOf(prefix) === 0) {
        return candidate;
      }
    }
    return null;
  }

  function typeahead(item, character) {
    if (typeTimer !== null) {
      clearTimeout(typeTimer);
    }
    typeTimer = setTimeout(function () {
      typeTimer = null;
      typeBuffer = '';
    }, TYPEAHEAD_RESET_MS);

    var typed = character.toLowerCase();
    typeBuffer += typed;

    var list = visibleItems();
    var startIndex = list.indexOf(item);
    if (startIndex === -1) {
      startIndex = 0;
    }

    // Multi-character search first ("wa" -> Walloon Region), which is what the
    // APG pattern describes.
    var match = findByPrefix(list, startIndex, typeBuffer);

    // If the accumulated buffer matches nothing, fall back to the character
    // that was just typed and start a new search from it. This keeps the
    // single-character behaviour intact - typing "n" then "b" in quick
    // succession moves to Netherlands and then to Belgium instead of getting
    // stuck on the dead prefix "nb" - and it also makes repeated presses of
    // the same key cycle through the nodes starting with that character.
    if (!match) {
      typeBuffer = typed;
      match = findByPrefix(list, startIndex, typeBuffer);
    }

    if (match) {
      setFocus(match);
    }
  }

  /* ------------------------------------------------------------ keyboard -- */

  tree.addEventListener('keydown', function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    var item = event.target.closest('[role="treeitem"]');
    if (!item || !tree.contains(item)) {
      return;
    }

    var list;
    var index;
    var handled = true;

    switch (event.key) {
      case 'ArrowRight':
        if (isExpandable(item)) {
          if (!isExpanded(item)) {
            setExpanded(item, true);
          } else {
            var firstChild = childItems(item)[0];
            if (firstChild) {
              setFocus(firstChild);
            }
          }
        }
        // On a leaf: deliberately does nothing.
        break;

      case 'ArrowLeft':
        if (isExpandable(item) && isExpanded(item)) {
          setExpanded(item, false);
        } else {
          var parent = parentItem(item);
          if (parent) {
            setFocus(parent);
          }
        }
        break;

      case 'ArrowDown':
        list = visibleItems();
        index = list.indexOf(item);
        if (index > -1 && index < list.length - 1) {
          setFocus(list[index + 1]);
        }
        break;

      case 'ArrowUp':
        list = visibleItems();
        index = list.indexOf(item);
        if (index > 0) {
          setFocus(list[index - 1]);
        }
        break;

      case 'Home':
        list = visibleItems();
        if (list.length) {
          setFocus(list[0]);
        }
        break;

      case 'End':
        list = visibleItems();
        if (list.length) {
          setFocus(list[list.length - 1]);
        }
        break;

      case ' ':
      case 'Spacebar': // legacy key name
      case 'Enter':
        // This prototype has no separate activation action, so Enter mirrors
        // Space rather than doing something the user cannot predict.
        toggleChecked(item);
        break;

      case '*':
        expandSiblings(item);
        break;

      default:
        if (event.key.length === 1 && event.key !== ' ') {
          typeahead(item, event.key);
        } else {
          handled = false;
        }
        break;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  /* -------------------------------------------------------------- mouse --- */

  tree.addEventListener('click', function (event) {
    var row = event.target.closest('.tree__row');
    if (!row || !tree.contains(row)) {
      return;
    }

    // The innermost row wins, so clicking a child never toggles its ancestor.
    var item = row.parentElement;
    if (!item || item.getAttribute('role') !== 'treeitem') {
      return;
    }

    setFocus(item);

    if (event.target.closest('.tree__twisty') && isExpandable(item)) {
      setExpanded(item, !isExpanded(item));
    } else {
      toggleChecked(item);
    }
  });

  /* ------------------------------------------------------ select field ---- */

  var toggle = document.getElementById('region-toggle');
  var panel = document.getElementById('region-panel');
  var searchInput = document.getElementById('region-search');
  var searchStatus = document.getElementById('search-status');
  var prevBtn = document.getElementById('result-prev');
  var nextBtn = document.getElementById('result-next');

  function setPanelOpen(open) {
    if (!toggle || !panel) {
      return;
    }
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.hidden = !open;
  }

  if (toggle && panel) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      setPanelOpen(open);
      if (open && searchInput) {
        searchInput.focus();
      }
    });

    // Escape closes the panel from anywhere inside it and returns focus to
    // the button. In a non-empty search box the first Escape only clears the
    // box (the native type="search" behaviour), the second one closes.
    panel.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') {
        return;
      }
      if (event.target === searchInput && searchInput.value !== '') {
        searchInput.value = '';
        runSearch();
        event.preventDefault();
        return;
      }
      event.preventDefault();
      setPanelOpen(false);
      toggle.focus();
    });
  }

  /* -------------------------------------------------------------- filter -- */

  function currentFilter() {
    var checked = document.querySelector('input[name="region-filter"]:checked');
    return checked ? checked.value : 'all';
  }

  function leafPassesFilter(item, filter) {
    var checked = item.getAttribute('aria-checked') === 'true';
    return filter === 'all' || (filter === 'selected') === checked;
  }

  /**
   * Hide leaves that do not pass the filter, and parents that have no visible
   * descendant left. The focused node is always kept visible, so unticking a
   * node under "Selected only" does not pull the focus out from under the
   * user; it disappears the next time the filter is applied.
   *
   * aria-posinset / aria-setsize are recomputed over the visible siblings,
   * otherwise "2 of 3" would be announced for a node that is now alone.
   */
  function applyFilter() {
    var filter = currentFilter();
    var focused = document.activeElement;
    var keep = focused && tree.contains(focused) ? focused : null;

    function visit(item) {
      var children = childItems(item);
      var show;
      if (children.length === 0) {
        show = leafPassesFilter(item, filter);
      } else {
        show = children.map(visit).some(Boolean);
      }
      if (keep && (item === keep || item.contains(keep))) {
        show = true;
      }
      item.hidden = !show;
      return show;
    }
    rootItems().forEach(visit);

    function renumber(siblings) {
      var shown = siblings.filter(function (s) { return !s.hidden; });
      shown.forEach(function (s, i) {
        s.setAttribute('aria-posinset', String(i + 1));
        s.setAttribute('aria-setsize', String(shown.length));
      });
    }
    renumber(rootItems());
    allItems().forEach(function (item) {
      if (!isLeaf(item)) {
        renumber(childItems(item));
      }
    });

    // The roving tabindex must never sit on a hidden node.
    var tabbable = allItems().filter(function (i) { return i.getAttribute('tabindex') === '0'; })[0];
    if (!tabbable || tabbable.hidden || !isVisibleItem(tabbable)) {
      var first = visibleItems()[0];
      allItems().forEach(function (i) {
        i.setAttribute('tabindex', i === first ? '0' : '-1');
      });
    }
  }

  function shownLeafCount() {
    return leafItems().filter(function (i) { return !i.hidden; }).length;
  }

  toArray(document.querySelectorAll('input[name="region-filter"]')).forEach(function (radio) {
    radio.addEventListener('change', function () {
      applyFilter();
      // Re-run the search so its matches only cover the nodes still shown,
      // and let that announcement carry the new count.
      if (searchInput && searchInput.value.trim() !== '') {
        runSearch();
      } else {
        announceSearch('Showing ' + shownLeafCount() + ' of ' + totalItems + ' regions');
      }
    });
  });

  var selectAllBtn = document.getElementById('select-all');
  var clearAllBtn = document.getElementById('clear-all');

  function setAllVisible(checked) {
    // Only the leaves that the filter shows are touched, so "Select all"
    // under "Not selected only" selects exactly what the user is looking at.
    leafItems().forEach(function (leaf) {
      if (!leaf.hidden) {
        setSubtreeChecked(leaf, checked);
        refreshAncestors(leaf);
      }
    });
    scheduleStatus();
  }
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', function () { setAllVisible(true); });
  }
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', function () { setAllVisible(false); });
  }

  /* -------------------------------------------------------------- search -- */

  var SEARCH_DEBOUNCE_MS = 300;
  var searchTimer = null;
  var matches = [];

  function normalise(text) {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function announceSearch(text) {
    if (searchStatus && searchStatus.textContent.trim() !== text) {
      searchStatus.textContent = text;
    }
  }

  /**
   * Substring search over the labels of every node the filter shows.
   * Matches get a highlight class and their ancestors are expanded, so every
   * hit is reachable with the arrow keys. Nothing is hidden by the search:
   * a match keeps its country and region around it for context. The count is
   * announced through the polite live region next to the box.
   */
  function runSearch() {
    var query = searchInput ? searchInput.value.trim() : '';
    var needle = normalise(query);

    matches = [];
    allItems().forEach(function (item) {
      var hit = needle !== '' && !item.hidden && normalise(labelOf(item)).indexOf(needle) !== -1;
      item.classList.toggle('tree__item--match', hit);
      if (hit) {
        matches.push(item);
        var ancestor = parentItem(item);
        while (ancestor) {
          setExpanded(ancestor, true);
          ancestor = parentItem(ancestor);
        }
      }
    });

    var none = matches.length === 0;
    if (prevBtn) { prevBtn.disabled = none; }
    if (nextBtn) { nextBtn.disabled = none; }

    if (needle === '') {
      announceSearch('');
    } else if (none) {
      announceSearch('No results for “' + query + '”');
    } else {
      announceSearch(matches.length + (matches.length === 1 ? ' result' : ' results') + ' for “' + query + '”');
    }
  }

  /**
   * Move focus to the next (direction 1) or previous (direction -1) match,
   * counted from the node that currently holds the roving tabindex and
   * wrapping around at either end. The position is announced as well, because
   * the focused node's name alone does not say which hit it is.
   */
  function stepResult(direction) {
    if (!matches.length) {
      return;
    }
    var all = allItems();
    var current = all.filter(function (i) { return i.getAttribute('tabindex') === '0'; })[0];
    var position = current ? all.indexOf(current) : -1;
    var target = null;
    if (direction > 0) {
      target = matches.filter(function (m) { return all.indexOf(m) > position; })[0] || matches[0];
    } else {
      var before = matches.filter(function (m) { return all.indexOf(m) < position; });
      target = before.length ? before[before.length - 1] : matches[matches.length - 1];
    }
    setFocus(target);
    announceSearch('Result ' + (matches.indexOf(target) + 1) + ' of ' + matches.length + ': ' + labelOf(target));
  }

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      if (searchTimer !== null) {
        clearTimeout(searchTimer);
      }
      searchTimer = setTimeout(function () {
        searchTimer = null;
        runSearch();
      }, SEARCH_DEBOUNCE_MS);
    });
    searchInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (searchTimer !== null) {
          clearTimeout(searchTimer);
          searchTimer = null;
          runSearch();
        }
        stepResult(event.shiftKey ? -1 : 1);
      }
    });
  }
  if (prevBtn) {
    prevBtn.addEventListener('click', function () { stepResult(-1); });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', function () { stepResult(1); });
  }

  /* --------------------------------------------------------------- init --- */

  // Guarantee the roving tabindex invariant even if the markup drifts.
  var items = allItems();
  if (items.length) {
    var initiallyTabbable = items.filter(function (item) {
      return item.getAttribute('tabindex') === '0';
    });
    var target = initiallyTabbable.length ? initiallyTabbable[0] : items[0];
    items.forEach(function (item) {
      item.setAttribute('tabindex', item === target ? '0' : '-1');
    });
  }

  // Bring the hidden state spans in line with the aria-checked values the
  // markup ships with, so the two can never start out disagreeing.
  allItems().forEach(function (item) {
    setCheckedState(item, item.getAttribute('aria-checked') || 'false');
  });

  // index.html already carries the correct starting text, so this normally
  // writes nothing at all - renderStatus only touches the DOM when the text
  // really changed. That keeps the live region from firing a spurious
  // announcement on page load.
  renderStatus();
})();
