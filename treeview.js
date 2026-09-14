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

  /** A node is visible when every ancestor node is expanded. */
  function isVisibleItem(item) {
    var ancestor = parentItem(item);
    while (ancestor) {
      if (!isExpanded(ancestor)) {
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
