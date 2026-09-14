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
- Every node also carries its depth and its tick state as hidden text inside its
  name, so the name you hear is "Antwerp, level 3, not checked" rather than bare
  "Antwerp". See [What VoiceOver does not
  announce](#what-voiceover-does-not-announce-confirmed-by-manual-testing) for
  why.
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
- a roving tabindex, so the tree is one tab stop;
- on top of the ARIA states, a visually hidden span per node, merged into the
  node's accessible name with `aria-labelledby`, that repeats the level and the
  tick state in plain words (", level 3, not checked"). This is a deliberate
  redundancy, added because VoiceOver announces neither of those two things by
  itself. The span is `aria-hidden="true"`, so it feeds the name but is not an
  object of its own in the reading order. It is described in full below.

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
  names, levels and checked values (`true` / `false` / `mixed`) for every node.
  Re-checked on 14 September 2026 after the VoiceOver fixes below: all 27 nodes
  expose a name of the form "Antwerp, level 3, not checked", it follows the
  ticking cascade for leaves, fully ticked parents and partly ticked parents,
  and the hidden helper spans no longer show up as separate objects in the
  browser's accessibility tree (before the second fix, every visible node had
  one such stray text object next to it);
- colour contrast, measured from the rendered page: text 15:1 or better (the AA
  threshold is 4.5:1), checkbox and triangle graphics 8:1 or better, focus ring
  7.2:1 (threshold 3:1);
- target size: the triangle you click to open a branch is a 24x24 px target,
  which is the WCAG 2.2 AA minimum, with a clear gap to the checkbox next to it.

**None of that tells us what a screen reader actually says out loud**, so the
prototype was also handed to a person with a real screen reader. The state of
that work is:

| Combination | Manually tested? | Result |
| --- | --- | --- |
| **VoiceOver + Safari** (macOS) | **Yes, 14 September 2026 (two sessions)** | Three real problems found, all now mitigated. Needs re-testing. |
| **NVDA + Chrome** (Windows) | **Not yet** | Expected to work, unverified. |
| **JAWS + Chrome** (Windows) | **Not yet** | Expected to work, unverified. |

### What VoiceOver does not announce (confirmed by manual testing)

On **14 September 2026** this prototype was tested by hand with
**VoiceOver + Safari**, not with automated tooling. Three findings, two of them
problems:

1. **`aria-checked` changes on `role="treeitem"` are not announced at all.**
   Pressing <kbd>Space</kbd> on a node produced **no audible change** of
   checked / unchecked. This is broader than the problem we had expected: it is
   not only the `mixed` state (WebKit bug 218316) that goes missing, VoiceOver
   does not reliably convey the plain `true` / `false` states on a tree item
   either. A blind VoiceOver user therefore had no way at all to tell what they
   had ticked.
2. **`aria-level` is not announced at all.** The explicit `aria-level` on every
   node, which exists precisely because WebKit often does not derive depth from
   the DOM, did not reach the user either. The tree was heard as a flat list.
3. `aria-posinset` / `aria-setsize` (the "1 of 5" position) **are** announced
   correctly. That part is fine and is deliberately left to the platform, so it
   is not duplicated anywhere.

**Mitigation (now in the code).** Everything VoiceOver refuses to announce is
mirrored into the node's **accessible name**, because name text is read
reliably by every screen reader regardless of how well it supports the ARIA
state itself. Each node has a visually hidden span that `treeview.js` keeps in
sync and that is merged into the name via `aria-labelledby`. The name of a node
is therefore always of the form:

```
<label>, level <n>, not checked      e.g. "Antwerp, level 3, not checked"
<label>, level <n>, checked          e.g. "Antwerp, level 3, checked"
<label>, level <n>, partially selected   e.g. "Belgium, level 1, partially selected"
```

VoiceOver rounds this off with its own position announcement, so what a tester
hears is "Antwerp, level 3, not checked, 1 of 5".

The cost is redundancy on screen readers that **do** support `aria-checked` and
`aria-level`: NVDA and JAWS will probably say the state twice ("not checked"
from the ARIA state and "not checked" from the name). That was accepted on
purpose, and it is the same rule the prototype already followed for the mixed
state: **a state that goes completely unannounced is far worse than one
announced twice.** Whether the repetition is annoying enough to tune is a
question for the NVDA and JAWS testers, not a reason to remove the fallback.

**This mitigation has not itself been heard yet.** It was written after the
VoiceOver session and verified only in Chromium (accessibility tree inspection
plus axe-core, 0 violations). **It must be re-verified by running the updated
VoiceOver script in section C below**, and the NVDA and JAWS scripts still need
a first run.

### VoiceOver's reading cursor skipped nodes (found 14 September 2026, second session)

A second VoiceOver + Safari session, run against the mitigation above, found a
new problem:

4. **One press of <kbd>Control</kbd>+<kbd>Option</kbd>+<kbd>Right Arrow</kbd>
   from "Belgium" landed straight on "Flemish Brabant"**, three nodes further
   down, without announcing "Flemish Region", "Antwerp" or "East Flanders" on
   the way. That is VoiceOver's own reading cursor, the normal way a VoiceOver
   user reads any page, and reading through a tree should visit one node per
   press, in the order they appear. Skipping three of them silently is wrong.

**Likely cause, in plain terms.** The hidden helper text that we added for
finding 1 and 2 (the ", level 3, not checked" part of every name) lived in a
small hidden element next to each node. That element was only hidden from
*sight*. To the screen reader it was still a thing of its own, sitting in the
reading order right after every node, in addition to lending its words to the
node's name. Twenty-seven of those stray, wordless-looking objects in the
reading order is exactly the kind of thing that throws a screen reader's own
cursor off. Chromium confirmed the stray objects: before the fix, every visible
node had a separate text object ", level N, not checked" next to it in the
browser's accessibility tree.

**Fix (now in the code).** Each helper element is now also marked
`aria-hidden="true"`. That takes it out of the reading order as an object,
while its text is still merged into the node's name through `aria-labelledby`,
which is what the accessible name rules prescribe for exactly this situation.
After the change, Chromium's accessibility tree shows no separate helper
objects at all, and every node still has its full name ("Antwerp, level 3, not
checked", "Belgium, level 1, partially selected", and so on). All behavioural
checks and axe-core (0 violations) still pass.

**Not yet confirmed live.** Chromium's accessibility tree is not Safari's, so
this is good evidence, not proof, that the skip is gone. It is the standard,
low-risk technique for this case, so it was applied with reasonable confidence,
but **it needs a real VoiceOver retest**: see step 8a in section C2 below.

## Manual test checklist

You do not need any screen reader experience to run these. Work through the
steps in order and write down what you hear.

**How to read the expected wording.** The last round of testing found this
checklist too vague to judge, so the VoiceOver section (C) now gives the
**exact phrase** you should hear, in quotes. Judge it like this:

- Text in `**bold quotes**` is the part that must match **word for word**. It
  comes out of the page itself, so it cannot vary between screen readers.
- Around it, each screen reader adds its own words for the role and the position
  ("tree item", "1 of 5", "expanded", and so on). The order of those extras and
  their exact wording may differ, and that is fine.
- If a bold-quoted phrase is **missing or different**, that is a **fail**. Write
  down what you heard instead, verbatim if you can.

Sections A (NVDA) and B (JAWS) have **not been run yet**, so their expected
wording is still a best guess and is marked as such.

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

> **Status: not yet tested.** Nobody has run this section with a real copy of
> NVDA. The expected wording below is what we believe NVDA will say, not what
> anyone has heard. Please correct it as you go.
>
> Because of the VoiceOver fix, every node's **name** now ends in ", level N,"
> plus the tick state. NVDA is expected to announce its own "not checked" and
> "level 3" **as well**, so you will probably hear the state and the level
> **twice** per node. That is known and intentional. Please note in your report
> whether the doubling is tolerable or irritating in normal use.

1. Open `index.html` in Chrome.
2. Start NVDA: <kbd>Control</kbd>+<kbd>Alt</kbd>+<kbd>N</kbd>. (To stop it
   later: <kbd>Insert</kbd>+<kbd>Q</kbd>, then Enter.)
3. Press <kbd>Control</kbd>+<kbd>Home</kbd> to go to the top of the page, then
   press <kbd>Tab</kbd> until you hear something like **"Geographic regions,
   tree, Belgium, level 1, not checked, tree item, not checked, level 1, 1 of 3,
   expanded"**.
   - The part that must be there word for word is the name:
     **"Belgium, level 1, not checked"**.
   - Everything after it is NVDA's own doing. Note down how much of it is
     repeated.
4. Press <kbd>Down Arrow</kbd> a few times. Each node should be announced with
   its own name, which now carries the depth: **"Flemish Region, level 2, not
   checked"**, then **"Antwerp, level 3, not checked"**, and so on.
5. Press <kbd>Up Arrow</kbd> back to **Belgium**, then press <kbd>Left Arrow</kbd>.
   - Expected: you hear **"collapsed"**, and the provinces disappear from the screen.
6. Press <kbd>Right Arrow</kbd>.
   - Expected: you hear **"expanded"**, and the list underneath comes back.
7. Press <kbd>Down Arrow</kbd> to "Flemish Region", <kbd>Right Arrow</kbd> to
   move into it, and <kbd>Down Arrow</kbd> until you are on **Antwerp**.
8. Press <kbd>Space</kbd>.
   - Expected: NVDA re-announces the node with its new name,
     **"Antwerp, level 3, checked"**, or at least says **"checked"**. A moment
     later you should also hear **"Selected: 1 of 20 regions"** read out
     automatically. Check the text above the tree on screen: it should show the
     same.
9. Press <kbd>Space</kbd> again to untick it. Expected:
   **"Antwerp, level 3, not checked"** (or at least "not checked"), and the
   counter goes back to **"Selected: 0 of 20 regions"**.
10. Go up to **Belgium** (<kbd>Home</kbd> is the quickest) and press
    <kbd>Space</kbd>.
    - Expected: **"Belgium, level 1, checked"**, and the counter announces
      **"Selected: 11 of 20 regions"** - 11, because Belgium has 11 provinces.
      It must not say 14.
11. Now move down to any one province under Belgium and press <kbd>Space</kbd>
    to untick just that one.
12. Press <kbd>Home</kbd> to move back to **Belgium**. (Using <kbd>Left Arrow</kbd>
    also works, but on an open branch the first press closes it instead of
    moving up, so <kbd>Home</kbd> is less confusing here.)
    - Expected, word for word, as part of the name:
      **"Belgium, level 1, partially selected"**. NVDA will most likely add its
      own **"partially checked"** or **"half checked"** on top. Write down the
      exact wording of both.
    - Also check the region in between: **"Flemish Region, level 2, partially
      selected"**.
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

> **Status: not yet tested**, exactly as for NVDA above. The same warning about
> hearing the state and level twice applies.

Run exactly the same steps 1 to 17 as for NVDA, with these differences:

- Start JAWS from the desktop icon or with
  <kbd>Insert</kbd>+<kbd>Alt</kbd>+<kbd>J</kbd>; stop it with
  <kbd>Insert</kbd>+<kbd>F4</kbd>.
- The mode switch key is <kbd>Insert</kbd>+<kbd>Z</kbd>.
- The bold-quoted names are identical to section A, because they come from the
  page: **"Antwerp, level 3, not checked"**, **"Antwerp, level 3, checked"**,
  **"Belgium, level 1, partially selected"**.
- JAWS tends to say "tree view" rather than "tree", and adds "half checked" or
  "partially checked" of its own for the partly ticked state. Any of those is
  fine on top of the name.
- JAWS may add "to expand press right arrow" style hints. That is expected.

### C. VoiceOver + Safari (macOS) - re-test of the 14 September 2026 fix

**Read this first.** On 14 September 2026 this combination was tested by hand
and two things were found to be completely silent: the checked / unchecked
state, and the level. Both are now carried in the node's **name** instead, so
this run is about one question: **do you now hear the level and the state, in
words, on every node?**

Every phrase in `**bold quotes**` below is text that comes straight out of the
page. It cannot vary between screen readers, so it must match **word for word**.
VoiceOver will wrap its own words around it ("tree item", "1 of 3", "expanded",
"selected"). Those extras may come in any order and are not what you are
judging.

The page opens with Belgium and Flemish Region already open, and nothing ticked.
If you have clicked around, reload the page with <kbd>Command</kbd>+<kbd>R</kbd>
before you start.

#### Setup

1. Open `index.html` in Safari.
2. Start VoiceOver: <kbd>Command</kbd>+<kbd>F5</kbd>. (The same shortcut stops it.)
3. If a "Welcome to VoiceOver" dialog appears, press <kbd>V</kbd> to skip it.
4. Make sure Safari can Tab to everything: Safari menu > Settings > Advanced >
   tick **"Press Tab to highlight each item on a webpage"**.
5. If VoiceOver's Quick Nav is on, single letters and arrow keys get captured by
   VoiceOver itself. Turn Quick Nav **off** now by pressing <kbd>Left Arrow</kbd>
   and <kbd>Right Arrow</kbd> together.

> **Before you go further: two different ways of moving around, only one of
> which works on this tree.**
>
> - <kbd>Control</kbd>+<kbd>Option</kbd>+<kbd>Arrow</kbd> moves VoiceOver's own
>   reading cursor through the page in document order, regardless of real
>   keyboard focus. It is meant for *reading* a page, not for operating a
>   custom widget: it walks *into* Belgium's already-open branches one node at
>   a time, and pressing <kbd>Space</kbd> wherever it stops ticks *that* node,
>   not Belgium. It does not move the tree's real focus, so it is the wrong
>   tool for the steps below.
> - Plain <kbd>Arrow</kbd> keys (no <kbd>Control</kbd>+<kbd>Option</kbd>) are
>   what the tree actually listens to, and they only work once real keyboard
>   focus is on a node inside it.
>
> So: use <kbd>Tab</kbd> (step 7 below) to place real focus on Belgium, then
> stay on plain arrow keys for every step in C1-C7. Only reach for
> <kbd>Control</kbd>+<kbd>Option</kbd>+<kbd>Arrow</kbd> for step 6, to read the
> page before you start, and for the one deliberate check in step 8a - not
> otherwise once you are inside the tree. If you catch yourself using it
> mid-test and land somewhere unexpected, that is this mix-up, not a new
> finding: press <kbd>Tab</kbd> back out and back in, or reload with
> <kbd>Command</kbd>+<kbd>R</kbd>, and continue with plain arrows.
>
> One clarification since the last round: in the previous session a single
> <kbd>Control</kbd>+<kbd>Option</kbd>+<kbd>Right Arrow</kbd> from Belgium jumped
> straight to "Flemish Brabant". We first put that down to the reading cursor
> being the wrong tool; it was not, it was finding 4 above (a hidden helper
> element getting in the reading cursor's way), and it has been fixed. The
> reading cursor should now step through the tree **one node per press**, in
> order. Step 8a checks exactly that.

#### C1. Entering the tree: is the level there?

6. Press <kbd>Control</kbd>+<kbd>Option</kbd>+<kbd>A</kbd> to read the page from
   the top, then <kbd>Control</kbd> to stop the reading.
7. Press <kbd>Tab</kbd> until focus lands in the tree, on Belgium.
   - **Expect to hear:** **"Belgium, level 1, not checked"**, followed by
     VoiceOver's own "tree item", "1 of 3" and "expanded" in some order.
   - **Pass** if the words "level 1" and "not checked" are in there.
   - **Fail** if you hear only "Belgium" and then role and position. Write down
     the whole utterance.

#### C2. Walking down: does every node say its own level and state?

8. Press <kbd>Down Arrow</kbd> four times, one press at a time, and check each
   one against this list. These are the first five visible nodes on a freshly
   loaded page:

   | Press | **Expect to hear (must match)** | VoiceOver may add |
   | --- | --- | --- |
   | (start) | **"Belgium, level 1, not checked"** | tree item, 1 of 3, expanded |
   | 1 | **"Flemish Region, level 2, not checked"** | tree item, 1 of 3, expanded |
   | 2 | **"Antwerp, level 3, not checked"** | tree item, 1 of 5 |
   | 3 | **"East Flanders, level 3, not checked"** | tree item, 2 of 5 |
   | 4 | **"Flemish Brabant, level 3, not checked"** | tree item, 3 of 5 |

   - The "1 of 5" / "2 of 5" part was already working before and should still be
     there. If it has disappeared, that is a regression: report it.
   - Each node must be announced with **its own name only**, never with the
     names of everything underneath it glued on.

8a. **Reading-cursor check (retest of finding 4).** Press <kbd>Home</kbd> to
    get back to Belgium, then press
    <kbd>Control</kbd>+<kbd>Option</kbd>+<kbd>Right Arrow</kbd> four times,
    one press at a time. This is VoiceOver's own reading cursor, not the tree's
    focus, so it is expected that VoiceOver adds different wrapping words here.
    - **Expect:** the same four names as in the table above, in the same order,
      **one per press**: Flemish Region, Antwerp, East Flanders, Flemish
      Brabant. Nothing skipped, and no extra stop that says only
      "level 2, not checked" without a place name in front of it.
    - **Fail** if a single press jumps past a node (as happened last time,
      Belgium straight to Flemish Brabant) or if there is an extra stop between
      two nodes. Write down every stop you heard.
    - When done, press <kbd>Tab</kbd> out of the tree and back in, so real focus
      is on Belgium again before you continue with step 9.

#### C3. Ticking a single province: is the change audible at all?

9. You should now be on **Flemish Brabant**. Press <kbd>Up Arrow</kbd> twice to
   get back to **Antwerp** (**"Antwerp, level 3, not checked"**).
10. Press <kbd>Space</kbd>.
    - **Expect to hear:** **"Antwerp, level 3, checked"**.
    - Roughly half a second later, separately: **"Selected: 1 of 20 regions"**.
    - **This is the single most important step in the whole script.** In the
      previous round, pressing Space here was completely silent about the state.
      If you again hear no word for the state, the fix has failed: write down
      exactly what you heard and stop to report it.
    - If <kbd>Space</kbd> does nothing at all, VoiceOver may be swallowing it:
      try <kbd>Control</kbd>+<kbd>Option</kbd>+<kbd>Space</kbd> instead, and note
      in your report which one worked.
11. Press <kbd>Space</kbd> again to untick it.
    - **Expect to hear:** **"Antwerp, level 3, not checked"**, then
      **"Selected: 0 of 20 regions"**.

#### C4. Ticking a whole country

12. Press <kbd>Home</kbd> to jump back to the top of the tree.
    - **Expect to hear:** **"Belgium, level 1, not checked"**.
13. Press <kbd>Space</kbd>.
    - **Expect to hear:** **"Belgium, level 1, checked"**.
    - Then: **"Selected: 11 of 20 regions"**. It must say **11**, not 14: the
      country and the two regions are groupings, not selectable regions.
14. Press <kbd>Down Arrow</kbd> twice, to Flemish Region and then to Antwerp.
    - **Expect to hear:** **"Flemish Region, level 2, checked"** and then
      **"Antwerp, level 3, checked"**. The tick cascaded downwards.

#### C5. The partly ticked state

15. You are on **Antwerp**, which is ticked. Press <kbd>Space</kbd> to untick
    just this one province.
    - **Expect to hear:** **"Antwerp, level 3, not checked"**, then
      **"Selected: 10 of 20 regions"**.
16. Press <kbd>Up Arrow</kbd> once, to its parent's level, and then
    <kbd>Home</kbd> to get to Belgium. Check both of these:
    - On the way, **"Flemish Region, level 2, partially selected"**.
    - On arrival, **"Belgium, level 1, partially selected"**.
    - VoiceOver may add "mixed" or "partially checked" of its own. Note it if it
      does, but the bold phrase is what decides pass or fail.
    - **Fail** if either one is announced the same as an unticked node. That
      would mean a user cannot tell "half of Belgium selected" from "none of
      Belgium selected".
17. Press <kbd>Space</kbd> on Belgium to tick it fully again.
    - **Expect to hear:** **"Belgium, level 1, checked"**, then
      **"Selected: 11 of 20 regions"**.

#### C6. Opening and closing, and moving about

18. On **Belgium**, press <kbd>Left Arrow</kbd>.
    - **Expect to hear:** **"collapsed"** (VoiceOver's own word), and the
      provinces disappear from the screen. The name **"Belgium, level 1,
      checked"** may be repeated with it.
19. Press <kbd>Right Arrow</kbd>.
    - **Expect to hear:** **"expanded"**, and the list underneath comes back.
20. Press <kbd>End</kbd>.
    - Focus should land on the **last** visible node in the whole tree and
      announce it. With the Netherlands and Germany still closed, that is
      **"Germany, level 1, not checked"**. If you have opened other branches, it
      is whatever is visually last.
21. Press <kbd>Home</kbd>.
    - **Expect to hear:** **"Belgium, level 1, checked"**.
22. Press the letter <kbd>n</kbd>.
    - **Expect to hear:** **"Netherlands, level 1, not checked"**.
    - If nothing happens, Quick Nav is back on: press <kbd>Left Arrow</kbd> and
      <kbd>Right Arrow</kbd> together and try again.
23. Press <kbd>Home</kbd>, then press <kbd>w</kbd> and <kbd>a</kbd> quickly one
    after the other.
    - **Expect to hear:** **"Walloon Region, level 2, checked"**.
24. Press <kbd>Tab</kbd> once.
    - Focus must leave the tree **entirely in one press**. It must not step to
      the next node in the tree.
25. Finally, open VoiceOver's rotor with
    <kbd>Control</kbd>+<kbd>Option</kbd>+<kbd>U</kbd>, check that the page
    structure looks sane, and close it with <kbd>Escape</kbd>.

#### C7. Is it too wordy?

26. Walk down ten or so nodes at a normal pace and judge one thing: is
    "Antwerp, level 3, not checked, tree item, 1 of 5" **usable**, or is it so
    long that moving through the tree becomes tiring? We can shorten the wording
    (for example drop "level" and say only the number), but only if you tell us
    it is a problem.

### What to send back

For each of the three combinations, please note:

1. Which steps behaved as expected, by their number (C1, C3, step 10, ...).
2. The **exact wording** you heard for: an unticked node, a ticked node, and a
   partly ticked country. Verbatim, including the extra words the screen reader
   added.
3. Whether the level ("level 1", "level 2", ...) was heard on every node.
4. Whether the "Selected: X of 20 regions" message was read out by itself after
   ticking, without you going to look for it.
5. Whether the "X of Y" position ("1 of 5") is still announced.
6. Anything that was silent, confusing, or read twice in an annoying way, and
   your answer to step 26 about the overall length.
7. For VoiceOver only: what step 8a gave, stop by stop. Did
   <kbd>Control</kbd>+<kbd>Option</kbd>+<kbd>Right Arrow</kbd> visit one node
   per press, in order, with nothing skipped and no extra stops?
