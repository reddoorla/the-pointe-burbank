import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { trapFocus, type TrapFocusOptions } from "./trapFocus";

// jsdom performs no layout, so getClientRects() is always empty and the
// action's visibility filter would reject everything. Treat connected
// elements as visible.
beforeEach(() => {
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (
    this: Element,
  ) {
    return (this.isConnected ? [{}] : []) as unknown as DOMRectList;
  });
  // Run rAF callbacks synchronously so mount-focus and restore-focus are
  // observable without frame plumbing.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

// The action attaches document-level listeners while active, so every trap a
// test mounts must be destroyed afterwards or it would leak into later tests.
// destroy() is idempotent — tests that destroy explicitly are re-destroyed
// harmlessly here.
const traps: Array<{ destroy(): void }> = [];
function mountTrap(node: HTMLElement, options?: TrapFocusOptions) {
  const action = trapFocus(node, options);
  traps.push(action);
  return action;
}

afterEach(() => {
  traps.splice(0).forEach((action) => action.destroy());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function overlayWithButtons(labels: string[]) {
  const overlay = document.createElement("div");
  const buttons = labels.map((label) => {
    const b = document.createElement("button");
    b.textContent = label;
    overlay.appendChild(b);
    return b;
  });
  document.body.appendChild(overlay);
  return { overlay, buttons };
}

function pressTab(target: Element, shiftKey = false) {
  const e = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(e);
  return e;
}

describe("trapFocus — initial focus", () => {
  it("focuses the first focusable child on mount", () => {
    const { buttons } = overlayWithButtons(["first", "second"]);
    mountTrap(buttons[0].parentElement as HTMLElement);
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("prefers a [data-autofocus] element over the first focusable", () => {
    const { overlay, buttons } = overlayWithButtons(["first", "second"]);
    buttons[1].setAttribute("data-autofocus", "");
    mountTrap(overlay);
    expect(document.activeElement).toBe(buttons[1]);
  });

  it("focuses the container itself when there are no focusable children", () => {
    const overlay = document.createElement("div");
    overlay.textContent = "Please rotate your device";
    document.body.appendChild(overlay);
    mountTrap(overlay);
    expect(overlay.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(overlay);
  });

  it("skips children hidden from layout (empty client rects)", () => {
    const { overlay, buttons } = overlayWithButtons(["hidden", "visible"]);
    const hidden = buttons[0];
    vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (
      this: Element,
    ) {
      return (this === hidden ? [] : [{}]) as unknown as DOMRectList;
    });
    mountTrap(overlay);
    expect(document.activeElement).toBe(buttons[1]);
  });
});

describe("trapFocus — Tab cycling", () => {
  it("wraps Tab on the last item back to the first", () => {
    const { overlay, buttons } = overlayWithButtons(["a", "b", "c"]);
    mountTrap(overlay);

    buttons[2].focus();
    const e = pressTab(buttons[2]);

    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("wraps Shift+Tab on the first item to the last", () => {
    const { overlay, buttons } = overlayWithButtons(["a", "b", "c"]);
    mountTrap(overlay);

    const e = pressTab(buttons[0], true);

    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[2]);
  });

  it("lets Tab proceed natively between interior items", () => {
    const { overlay, buttons } = overlayWithButtons(["a", "b", "c"]);
    mountTrap(overlay);

    buttons[1].focus();
    const e = pressTab(buttons[1]);

    // Not wrapped — the browser's normal tab order takes over.
    expect(e.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(buttons[1]);
  });

  it("intercepts Tab dispatched from OUTSIDE the overlay after focus escaped", () => {
    const { overlay, buttons } = overlayWithButtons(["a", "b"]);
    mountTrap(overlay);

    // Focus escapes to <body>, as after a click on a non-focusable area. blur()
    // fires no focusin, so only the keydown path can recover from here — and
    // the event never passes through the overlay node, so a node-attached
    // listener (the old implementation) would never see it.
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);

    const e = pressTab(document.body);

    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("does not trap Tab when there are no focusable children", () => {
    const overlay = document.createElement("div");
    document.body.appendChild(overlay);
    mountTrap(overlay);

    const e = pressTab(overlay);
    expect(e.defaultPrevented).toBe(false);
  });
});

describe("trapFocus — focusin recovery", () => {
  it("pulls focus back into the overlay when it lands on an outside element", () => {
    const { overlay, buttons } = overlayWithButtons(["a", "b"]);
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    mountTrap(overlay);

    // Real focus movement to an element OUTSIDE the overlay — jsdom dispatches
    // focusin, which only a document-level listener can observe.
    outside.focus();

    expect(document.activeElement).toBe(buttons[0]);
  });

  it("leaves outside focus alone when the overlay has no focusable children", () => {
    // The degenerate informational overlay has no Tab trap (see the action's
    // header); yanking focus back with no Escape would be a 2.1.2 keyboard
    // trap, so focusin recovery must stay off too.
    const overlay = document.createElement("div");
    overlay.textContent = "Please rotate your device";
    document.body.appendChild(overlay);
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    mountTrap(overlay);
    expect(document.activeElement).toBe(overlay);

    outside.focus();

    expect(document.activeElement).toBe(outside);
  });

  it("stops recovering once disabled", () => {
    const { overlay, buttons } = overlayWithButtons(["a"]);
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    const action = mountTrap(overlay);
    expect(document.activeElement).toBe(buttons[0]);

    action.update({ enabled: false });
    outside.focus();

    expect(document.activeElement).toBe(outside);
  });
});

describe("trapFocus — Escape", () => {
  it("calls onEscape and swallows the event", () => {
    const onEscape = vi.fn();
    const { overlay, buttons } = overlayWithButtons(["a"]);
    mountTrap(overlay, { onEscape });

    const e = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    buttons[0].dispatchEvent(e);

    expect(onEscape).toHaveBeenCalledOnce();
    expect(e.defaultPrevented).toBe(true);
  });

  it("ignores Escape when no onEscape is provided", () => {
    const { overlay, buttons } = overlayWithButtons(["a"]);
    mountTrap(overlay);

    const e = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    buttons[0].dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });
});

describe("trapFocus — restore on destroy", () => {
  it("restores focus to the previously focused element", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    const { overlay, buttons } = overlayWithButtons(["a"]);
    const action = mountTrap(overlay);
    expect(document.activeElement).toBe(buttons[0]);

    action.destroy();
    expect(document.activeElement).toBe(trigger);
  });

  it("uses restoreFocus when the original trigger unmounted while open", () => {
    // Model a menu button inside {#if !open}: the element focused at open time
    // is detached by close time, and a fresh instance has re-mounted.
    const oldTrigger = document.createElement("button");
    document.body.appendChild(oldTrigger);
    oldTrigger.focus();

    const { overlay } = overlayWithButtons(["a"]);
    const newTrigger = document.createElement("button");
    const action = mountTrap(overlay, { restoreFocus: () => newTrigger });

    oldTrigger.remove();
    document.body.appendChild(newTrigger);
    action.destroy();

    expect(document.activeElement).toBe(newTrigger);
  });

  it("does not restore to a detached element", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    const { overlay, buttons } = overlayWithButtons(["a"]);
    const action = mountTrap(overlay);

    trigger.remove();
    action.destroy();

    // Nothing valid to restore to — focus stays where it was.
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("keeps focus on an element focused between deactivate and the restore frame", () => {
    // With a fade outro the action's destroy() — and its deferred restore —
    // can fire long after the overlay closed. Queue rAF callbacks instead of
    // running them synchronously so we can focus something in that window.
    const queued: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      queued.push(cb);
      return queued.length;
    });
    const flushFrames = () => queued.splice(0).forEach((cb) => cb(0));

    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    const { overlay, buttons } = overlayWithButtons(["a"]);
    const action = mountTrap(overlay);
    flushFrames(); // mount focus
    expect(document.activeElement).toBe(buttons[0]);

    action.destroy();
    // A successor overlay's trap (or the user) claims focus before the
    // restore frame runs — the restore must not steal it back.
    const successor = document.createElement("button");
    document.body.appendChild(successor);
    successor.focus();

    flushFrames(); // restore frame
    expect(document.activeElement).toBe(successor);
  });

  it("still restores when focus was merely lost to <body> before the restore frame", () => {
    // Companion to the test above: an unclaimed activeElement (body) is not
    // "someone else took focus" — the restore should proceed.
    const queued: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      queued.push(cb);
      return queued.length;
    });
    const flushFrames = () => queued.splice(0).forEach((cb) => cb(0));

    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    const { overlay, buttons } = overlayWithButtons(["a"]);
    const action = mountTrap(overlay);
    flushFrames();
    expect(document.activeElement).toBe(buttons[0]);

    action.destroy();
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);

    flushFrames();
    expect(document.activeElement).toBe(trigger);
  });
});

describe("trapFocus — enabled option", () => {
  it("is a complete no-op when mounted with enabled: false", () => {
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();

    const { overlay, buttons } = overlayWithButtons(["a", "b"]);
    const action = mountTrap(overlay, { enabled: false });

    // No focus stolen on mount.
    expect(document.activeElement).toBe(outside);

    // No Tab trap.
    buttons[1].focus();
    const e = pressTab(buttons[1]);
    expect(e.defaultPrevented).toBe(false);

    // No focus restore on destroy.
    buttons[0].focus();
    action.destroy();
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("activates when update flips enabled to true", () => {
    const { overlay, buttons } = overlayWithButtons(["a", "b"]);
    const action = mountTrap(overlay, { enabled: false });

    action.update({ enabled: true });
    expect(document.activeElement).toBe(buttons[0]);

    buttons[1].focus();
    const e = pressTab(buttons[1]);
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("releases the trap and restores focus when update flips enabled to false", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    const { overlay, buttons } = overlayWithButtons(["a"]);
    const action = mountTrap(overlay);
    expect(document.activeElement).toBe(buttons[0]);

    action.update({ enabled: false });
    expect(document.activeElement).toBe(trigger);

    const e = pressTab(buttons[0], true);
    expect(e.defaultPrevented).toBe(false);
  });
});
