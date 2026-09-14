# Accessible multi-select treeview - prototype

## What this is

This is a small, self-contained prototype of an accessible **multi-select tree
with checkboxes**, built as a reference implementation for the Eurostat region
filter. It exists because the semantics have to be right *from the start*: the
earlier attempt bolted ARIA attributes onto markup that was never a tree, which
worked well enough in Chrome but left VoiceOver announcing a broken, flattened
list that users could not navigate. This version is a real
`tree` / `treeitem` / `group` structure with a roving tabindex, tri-state
checkboxes and full keyboard support, written in plain HTML, CSS and JavaScript
so that anybody can read it and copy the parts they need. The sample data is
three levels deep (country > region > province): Belgium, the Netherlands and
Germany, 27 nodes of which **20 are selectable regions** (the country and region
nodes are grouping nodes, so they are not counted in the total).

## How to open it

There is **no build step, no installation and no server**. Just open the file:

- double-click `index.html` in your file manager, or
- drag `index.html` onto a browser window, or
- run `firefox index.html` (or `chrome index.html`) from a terminal.

It is written to work from a plain `file://` address as well as from a web
server, so you can also e-mail the folder to someone and it will still work.

| File | What it is |
| --- | --- |
| `index.html` | The markup: the tree itself, all roles and ARIA states. |
| `styles.css` | The styling. Every visual state is driven by the ARIA state, so the two cannot drift apart. |
| `treeview.js` | The behaviour: keyboard, focus, the checkbox cascade and the "Selected: X of 20" counter. |

## Keyboard reference

The whole tree is a **single tab stop**: <kbd>Tab</kbd> moves into the tree and
<kbd>Tab</kbd> again moves out of it. You never tab from node to node - inside
the tree you use the arrow keys. This is what the ARIA guidelines prescribe for
a tree, and it is why keyboard users do not have to press Tab 27 times to get
past the filter.

| Key | What it does |
| --- | --- |
| <kbd>Tab</kbd> | Move into the tree (landing on the node that was last focused, or the first one), or out of it again. |
| <kbd>Right Arrow</kbd> | On a collapsed country or region: open it. On an already open one: move to its first child. On a province: nothing. |
| <kbd>Left Arrow</kbd> | On an open country or region: close it. On a closed one or on a province: move up to the parent node. |
| <kbd>Down Arrow</kbd> | Move to the next visible node. |
| <kbd>Up Arrow</kbd> | Move to the previous visible node. |
| <kbd>Home</kbd> | Move to the first visible node in the tree. |
| <kbd>End</kbd> | Move to the last visible node in the tree. |
| <kbd>Space</kbd> | Tick or untick the checkbox of the current node. |
| <kbd>Enter</kbd> | The same as <kbd>Space</kbd>. This prototype has no separate "activate" action, so Enter is not given a second, unpredictable meaning. |
| <kbd>*</kbd> (asterisk) | Open every node at the same level as the current one. |
| any letter or digit | Jump to the next visible node whose name starts with that character. Typing several characters quickly searches the whole prefix (`w`, `a` finds "Walloon Region"). Case-insensitive, and it wraps around at the end of the list. |

With the mouse: click a name or a checkbox to tick or untick it, click the
triangle to open or close a branch.

### How ticking works

- Ticking a country ticks everything underneath it.
- Unticking one province under a ticked country leaves the country **partly**
  ticked: the checkbox shows a dash instead of a check mark, and screen readers
  announce it as partially checked / partially selected.
- The counter above the tree, "Selected: X of 20 regions", counts **provinces
  only**. Ticking all of Belgium therefore moves it to 11, not to 14, because
  "Belgium", "Flemish Region" and "Walloon Region" are groupings and not regions
  you can get data for.
- That counter is a live region, so screen readers read the new number out loud
  shortly after you finish ticking, without you having to go and look for it.

## ARIA pattern used

This follows the
[WAI-ARIA Authoring Practices Guide tree view pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/),
specifically the **checkbox / multi-select variant** of it:

- `role="tree"` with `aria-multiselectable="true"` on the container;
- `role="treeitem"` on every node and `role="group"` on every nested list;
- selection expressed with the tri-state `aria-checked`: `true` (everything
  underneath is selected), `false` (nothing is) and `mixed` (some of it is);
- `aria-expanded` for open and closed branches;
- explicit `aria-level`, `aria-posinset` and `aria-setsize` on every node, so
  screen readers can say "level 2, 3 of 5" even when the browser does not work
  that out by itself;
- a roving tabindex, so the tree is one tab stop.

Deliberately **not** used: real `<input type="checkbox">` elements inside the
nodes. They would each become their own tab stop and break the single-tab-stop
model that the pattern depends on.

## Known limitations - what still needs real testing

Everything below was checked **automatically, in Chromium only**, using
Playwright and axe-core:

- 29 behavioural checks: opening and closing branches, every key in the table
  above, the ticking cascade in both directions, the single tab stop, mouse
  clicks, and the "Selected: X of 20" counter;
- axe-core 4.13: **0 violations, 0 incomplete**;
- the structural ARIA: the browser's own accessibility tree reports the right
  names, levels and checked values (`true` / `false` / `mixed`) for every node;
- colour contrast, measured from the rendered page: text 15:1 or better (the AA
  threshold is 4.5:1), checkbox and triangle graphics 8:1 or better, focus ring
  7.2:1 (threshold 3:1);
- target size: the triangle you click to open a branch is a 24x24 px target,
  which is the WCAG 2.2 AA minimum, with a clear gap to the checkbox next to it.

**None of this tells us what a screen reader actually says out loud.** No screen
reader is installed in the environment this was built in, and an automated tool
cannot substitute for one. Real testing with **NVDA + Chrome**, **JAWS + Chrome**
and **VoiceOver + Safari** is still required before this pattern goes into a
production component.

### The one thing to watch most closely: the "partly ticked" state in VoiceOver

Safari and VoiceOver have a long history of not reporting `aria-checked="mixed"`
on a tree item (see the history of WebKit bug 218316). If that support is still
missing, a partly ticked country would be announced exactly like an unticked
one, and a blind user would have no way to tell that they had selected half of
Belgium.

This prototype defends against that: each node carries an extra, visually
hidden piece of text that is empty normally and reads **"partially selected"**
while the node is partly ticked, and that text is part of the node's name. So
even a screen reader that ignores the `mixed` state still says something like
"Belgium, partially selected, tree item". NVDA and JAWS, which do support the
`mixed` state, will say both ("partially checked" plus the extra words) - a
small amount of repetition that we accepted on purpose, because a state that
goes completely unannounced is far worse than one announced twice.

**When you test, please report back on exactly this:** what each screen reader
says on a partly ticked country, and whether the repetition on NVDA and JAWS is
acceptable or should be tuned.

## Manual test checklist

You do not need any screen reader experience to run these. Work through the
steps in order and write down what you hear. Where the expected wording is given,
it is approximate: every screen reader phrases things slightly differently, and
the point is whether the **information** is there, not the exact words.

General tips before you start:

- Turn the volume up before you start the screen reader, and make sure you know
  the stop shortcut (listed per test below).
- Screen readers speak a lot. It is normal not to catch everything the first
  time. Repeat a step as often as you need.
- If the arrow keys start reading the page instead of moving through the tree,
  you are in "browse mode". Press <kbd>NVDA</kbd>+<kbd>Space</kbd> (NVDA) or
  <kbd>Insert</kbd>+<kbd>Z</kbd> (JAWS) to switch, then click on a tree node
  again. NVDA and JAWS normally switch by themselves when you Tab into the tree.
- The `NVDA` key is <kbd>Insert</kbd> (or <kbd>Caps Lock</kbd> in laptop
  layout). The `VO` keys are <kbd>Control</kbd>+<kbd>Option</kbd> held together.

### A. NVDA + Chrome (Windows)

1. Open `index.html` in Chrome.
2. Start NVDA: <kbd>Control</kbd>+<kbd>Alt</kbd>+<kbd>N</kbd>. (To stop it
   later: <kbd>Insert</kbd>+<kbd>Q</kbd>, then Enter.)
3. Press <kbd>Control</kbd>+<kbd>Home</kbd> to go to the top of the page, then
   press <kbd>Tab</kbd> until you hear something like **"Geographic regions,
   tree, Belgium, tree item, not checked, level 1, 1 of 3, expanded"**.
   - Check: does it say "tree" and "tree item"? Does it say a **level**? Does it
     say **"not checked"**? All three must be there.
4. Press <kbd>Down Arrow</kbd> a few times. You should hear each node announced
   with its own name and level, going deeper as you enter Belgium
   ("Flemish Region, level 2", "Antwerp, level 3", ...).
5. Press <kbd>Up Arrow</kbd> back to **Belgium**, then press <kbd>Left Arrow</kbd>.
   - Expected: you hear **"collapsed"**, and the provinces disappear from the screen.
6. Press <kbd>Right Arrow</kbd>.
   - Expected: you hear **"expanded"**, and the list underneath comes back.
7. Press <kbd>Down Arrow</kbd> to "Flemish Region", <kbd>Right Arrow</kbd> to
   move into it, and <kbd>Down Arrow</kbd> until you are on **Antwerp**.
8. Press <kbd>Space</kbd>.
   - Expected: you hear **"checked"** (or "selected"). A moment later you should
     also hear **"Selected: 1 of 20 regions"** read out automatically. Check the
     text above the tree on screen: it should show the same.
9. Press <kbd>Space</kbd> again to untick it, and confirm you hear
   **"not checked"** and the counter goes back to 0.
10. Go up to **Belgium** (<kbd>Home</kbd> is the quickest) and press
    <kbd>Space</kbd>.
    - Expected: **"checked"**, and the counter announces
      **"Selected: 11 of 20 regions"** - 11, because Belgium has 11 provinces.
      It must not say 14.
11. Now move down to any one province under Belgium and press <kbd>Space</kbd>
    to untick just that one.
12. Press <kbd>Home</kbd> to move back to **Belgium**. (Using <kbd>Left Arrow</kbd>
    also works, but on an open branch the first press closes it instead of
    moving up, so <kbd>Home</kbd> is less confusing here.)
    - Expected: Belgium is announced as **"partially checked"** or
      **"half checked"**, and/or you hear the words **"partially selected"** in
      its name. Write down the exact wording.
    - Also check the region in between (for example "Flemish Region"): it should
      be partly ticked too.
13. Press <kbd>End</kbd>.
    - Expected: focus lands on the **last** visible node ("Germany" if nothing
      else is open) and it is announced.
14. Press <kbd>Home</kbd>.
    - Expected: focus lands on **Belgium** and it is announced.
15. Press the letter <kbd>n</kbd>.
    - Expected: focus jumps to **Netherlands** and it is announced. Press
      <kbd>Home</kbd>, then <kbd>w</kbd> and <kbd>a</kbd> quickly one after the
      other: focus should jump to **Walloon Region**.
16. Press <kbd>Tab</kbd> once.
    - Expected: focus leaves the tree entirely in one press (it should not step
      to the next region in the tree).
17. Finally, confirm the counter on screen matches what you have ticked.

### B. JAWS + Chrome (Windows)

Run exactly the same steps 1 to 17 as for NVDA, with these differences:

- Start JAWS from the desktop icon or with
  <kbd>Insert</kbd>+<kbd>Alt</kbd>+<kbd>J</kbd>; stop it with
  <kbd>Insert</kbd>+<kbd>F4</kbd>.
- The mode switch key is <kbd>Insert</kbd>+<kbd>Z</kbd>.
- JAWS tends to say "tree view" rather than "tree", and "half checked" or
  "partially checked" for the partly ticked state. Any of those is fine; what
  matters is that it says *something* other than plain "not checked".
- JAWS may add "to expand press right arrow" style hints. That is expected.

### C. VoiceOver + Safari (macOS)

This is the combination most likely to show problems, so please go slowly here.

1. Open `index.html` in Safari.
2. Start VoiceOver: <kbd>Command</kbd>+<kbd>F5</kbd>. (The same shortcut stops it.)
3. If a "Welcome to VoiceOver" dialog appears, press <kbd>V</kbd> to skip it.
4. Make sure Safari can Tab to everything: Safari menu > Settings > Advanced >
   tick **"Press Tab to highlight each item on a webpage"**.
5. Press <kbd>Control</kbd>+<kbd>Option</kbd>+<kbd>A</kbd> to have the page read
   from the top, then <kbd>Control</kbd> to stop the reading.
6. Press <kbd>Tab</kbd> until you reach the tree. Expected: something like
   **"Belgium, tree item, level 1, 1 of 3, expanded, unchecked"**.
   - Check specifically: **is a level announced?** VoiceOver sometimes presents a
     tree as a flat list. The prototype sets the level explicitly to prevent
     that, so this is a direct test of that fix.
7. Press <kbd>Down Arrow</kbd> and <kbd>Up Arrow</kbd> to walk through the
   visible nodes, and check that each one is announced with its own name (not
   with the names of everything underneath it glued on).
8. On **Belgium**, press <kbd>Left Arrow</kbd> then <kbd>Right Arrow</kbd>.
   - Expected: "collapsed" and "expanded" announcements, matching what you see.
9. Navigate to any single province and press <kbd>Space</kbd>.
   - Expected: you hear **"checked"** or **"selected"**, and shortly after
     **"Selected: 1 of 20 regions"**.
   - If <kbd>Space</kbd> does nothing, VoiceOver may be intercepting it: try
     <kbd>Control</kbd>+<kbd>Option</kbd>+<kbd>Space</kbd> instead, and note in
     your report which one worked.
10. Press <kbd>Home</kbd> to get back to Belgium, press <kbd>Space</kbd> to tick
    the whole country, and confirm you hear **"Selected: 11 of 20 regions"**.
11. **The key test.** Untick one single province under Belgium, then move back
    to **Belgium** itself.
    - Expected: you hear either **"partially checked" / "mixed"**, or at minimum
      the words **"partially selected"** as part of the name
      ("Belgium, partially selected, tree item").
    - **If you hear neither**, write that down and flag it - that is exactly the
      VoiceOver gap this prototype is trying to cover, and it means the fallback
      is not working either.
12. Check the same thing on the region in between ("Flemish Region").
13. Press <kbd>End</kbd> and <kbd>Home</kbd> and confirm focus jumps to the last
    and the first visible node.
14. Press <kbd>n</kbd> and confirm focus jumps to "Netherlands". (If VoiceOver's
    Quick Nav is on, single letters are captured by VoiceOver itself. Turn Quick
    Nav off by pressing <kbd>Left Arrow</kbd>+<kbd>Right Arrow</kbd> together,
    then try again.)
15. Press <kbd>Tab</kbd> and confirm you leave the tree in a single press.
16. Finally, open VoiceOver's rotor with
    <kbd>Control</kbd>+<kbd>Option</kbd>+<kbd>U</kbd> and check that the page
    structure looks sane. Close it with <kbd>Escape</kbd>.

### What to send back

For each of the three combinations, please note:

1. Which steps behaved as expected.
2. The **exact wording** you heard for: a normal node, a ticked node, and a
   partly ticked country.
3. Whether the level ("level 1", "level 2", ...) was announced.
4. Whether the "Selected: X of 20 regions" message was read out by itself after
   ticking, without you going to look for it.
5. Anything that was silent, confusing, or read twice in an annoying way.
