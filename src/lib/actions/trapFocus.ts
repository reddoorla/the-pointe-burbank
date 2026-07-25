// Focus management for modal overlays (WCAG 2.4.3 focus order + 2.1.2 no keyboard
// trap). Apply with `use:trapFocus` to an overlay element that is gated by an
// `{#if}` block, so the action's mount/destroy lifecycle matches open/close.
//
// On open it moves focus into the overlay; while open it cycles Tab/Shift+Tab
// within the overlay (so focus can't reach the now-inert page behind it); on
// close it restores focus to whatever was focused before — usually the control
// that opened the overlay.
//
// Listeners attach to `document`, not the overlay node: if focus ever escapes
// the overlay (e.g. a click on a non-focusable area drops focus on <body>), a
// node-scoped keydown listener would never see another keystroke and Tab would
// walk the page behind the overlay with no way back. From the document we still
// see every key, and a `focusin` listener pulls focus straight back into the
// overlay the moment it lands outside.
//
// Degenerate case: an overlay with no focusable children (e.g. an informational
// "rotate your device" modal) gets focus moved to the container but NO Tab trap
// and NO focusin recovery, because trapping with no focusable target and no
// Escape would itself be a keyboard trap (2.1.2). Pass `onEscape` for overlays
// that should close on Escape; omit it where the host component already handles
// Escape. Not for `<dialog>` opened via `showModal()` — the browser already
// provides all of this natively.

export type TrapFocusOptions = {
  /** Called when Escape is pressed inside the overlay. Omit if the host handles it. */
  onEscape?: () => void;
  /** When false the action is inert. Default true. */
  enabled?: boolean;
  /**
   * Where to send focus on close, evaluated one frame after destroy. Needed when
   * the opening control itself unmounts while the overlay is open (e.g. a menu
   * button inside `{#if !open}`): the element captured at open is detached by
   * close time, so return the re-mounted trigger here instead.
   */
  restoreFocus?: () => HTMLElement | null | undefined;
};

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/** Visible, focusable descendants. `getClientRects()` is empty for display:none
 *  (and correctly non-empty inside a position:fixed container, where offsetParent
 *  would be null). */
function focusable(node: HTMLElement): HTMLElement[] {
  return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0,
  );
}

export function trapFocus(node: HTMLElement, options: TrapFocusOptions = {}) {
  let opts = options;
  let active = false;
  // What had focus before the overlay opened, so we can restore it on close.
  let previouslyFocused: HTMLElement | null = null;

  const moveFocusIn = () => {
    const preferred = node.querySelector<HTMLElement>("[data-autofocus]");
    const target = preferred ?? focusable(node)[0];
    if (target) {
      target.focus();
    } else {
      // No focusable children: focus the container so AT announces the dialog
      // and focus leaves the inert background. No Tab trap (see file header).
      if (!node.hasAttribute("tabindex")) node.setAttribute("tabindex", "-1");
      node.focus();
    }
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && opts.onEscape) {
      e.preventDefault();
      opts.onEscape();
      return;
    }
    if (e.key !== "Tab") return;

    const items = focusable(node);
    if (items.length === 0) return; // nothing to cycle — no trap

    const first = items[0];
    const last = items[items.length - 1];
    const activeEl = document.activeElement;

    // Wrap decisions stay scoped to the node: a Tab from outside the overlay
    // (escaped focus) is intercepted and sent back in.
    if (e.shiftKey) {
      if (activeEl === first || !node.contains(activeEl)) {
        e.preventDefault();
        last.focus();
      }
    } else if (activeEl === last || !node.contains(activeEl)) {
      e.preventDefault();
      first.focus();
    }
  };

  // Focus landed outside the overlay (click on a focusable element behind it,
  // programmatic focus, …) — pull it back in. Skipped when the overlay has no
  // focusable children, for the same 2.1.2 reason the Tab trap is (see header).
  const onFocusin = (e: FocusEvent) => {
    if (node.contains(e.target as Node)) return;
    if (focusable(node).length === 0) return;
    moveFocusIn();
  };

  const activate = () => {
    if (active) return;
    active = true;
    previouslyFocused = document.activeElement as HTMLElement | null;
    // Defer past the open transition so the element is laid out before focusing.
    requestAnimationFrame(() => {
      if (active) moveFocusIn();
    });
    // Document-level so the trap still sees events after focus has escaped the
    // overlay — a node-scoped listener would be unreachable from outside it.
    document.addEventListener("keydown", onKeydown);
    document.addEventListener("focusin", onFocusin);
  };

  const deactivate = () => {
    if (!active) return;
    active = false;
    document.removeEventListener("keydown", onKeydown);
    document.removeEventListener("focusin", onFocusin);
    // Defer a frame so a trigger that re-mounts on close exists before we focus
    // it.
    const captured = previouslyFocused;
    requestAnimationFrame(() => {
      const target = opts.restoreFocus?.() ?? captured;
      if (!target?.isConnected || typeof target.focus !== "function") return;
      // With an outro transition, destroy() — and so this frame — can run long
      // after the overlay visually closed. Restore only while focus is still
      // unclaimed (lost to <body> or stranded inside the closing overlay);
      // never steal it from a successor overlay's trap or from anything the
      // user has focused in the meantime.
      const current = document.activeElement;
      if (
        current === null ||
        current === document.body ||
        node.contains(current)
      ) {
        target.focus();
      }
    });
  };

  if (opts.enabled !== false) activate();

  return {
    update(next: TrapFocusOptions = {}) {
      const wasEnabled = opts.enabled !== false;
      opts = next;
      const isEnabled = opts.enabled !== false;
      if (isEnabled && !wasEnabled) activate();
      else if (!isEnabled && wasEnabled) deactivate();
    },
    destroy() {
      deactivate();
    },
  };
}
