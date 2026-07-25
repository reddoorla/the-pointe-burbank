import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import TurnstileWidget from "./TurnstileWidget.svelte";
import type { TurnstileApi } from "$lib/turnstile";

afterEach(() => cleanup());

// Mutable so each test can set/clear the sitekey before mounting; the component
// reads the env at instance init, not module load, so this works per-render.
const mockEnv = vi.hoisted(() => ({
  env: {} as { PUBLIC_TURNSTILE_SITE_KEY?: string },
}));
vi.mock("$env/dynamic/public", () => mockEnv);

// With `window.turnstile` already present, $lib/turnstile's loadTurnstile
// resolves it directly — no <script> injection, so jsdom never hits the network.
function stubTurnstile() {
  const api = {
    render: vi.fn<TurnstileApi["render"]>(() => "widget-1"),
    remove: vi.fn<TurnstileApi["remove"]>(),
    reset: vi.fn<TurnstileApi["reset"]>(),
  };
  window.turnstile = api;
  return api;
}

describe("TurnstileWidget", () => {
  beforeEach(() => {
    delete mockEnv.env.PUBLIC_TURNSTILE_SITE_KEY;
    delete window.turnstile;
  });

  it("renders nothing when PUBLIC_TURNSTILE_SITE_KEY is unset", async () => {
    const api = stubTurnstile();
    const { container } = render(TurnstileWidget);

    // Flush the microtask the effect's loadTurnstile().then() would run on.
    await Promise.resolve();
    await Promise.resolve();

    expect(container.querySelector(".cf-turnstile")).toBeNull();
    expect(api.render).not.toHaveBeenCalled();
  });

  it("stays dark when the sitekey is whitespace-only", async () => {
    mockEnv.env.PUBLIC_TURNSTILE_SITE_KEY = "   ";
    const api = stubTurnstile();
    const { container } = render(TurnstileWidget);

    await Promise.resolve();
    await Promise.resolve();

    expect(container.querySelector(".cf-turnstile")).toBeNull();
    expect(api.render).not.toHaveBeenCalled();
  });

  it("renders the mount point and forwards tokens via onToken", async () => {
    mockEnv.env.PUBLIC_TURNSTILE_SITE_KEY = " site-key ";
    const api = stubTurnstile();
    const onToken = vi.fn();
    const { container } = render(TurnstileWidget, { onToken });

    await vi.waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));

    const el = container.querySelector(".cf-turnstile");
    expect(el).not.toBeNull();
    const [renderedEl, opts] = api.render.mock.calls[0];
    expect(renderedEl).toBe(el);
    // Trimmed: a stray-whitespace sitekey value must not reach Cloudflare.
    expect(opts.sitekey).toBe("site-key");

    opts.callback?.("tok-123");
    expect(onToken).toHaveBeenCalledWith("tok-123");
  });

  it("resets the token and removes the widget on unmount", async () => {
    mockEnv.env.PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    const api = stubTurnstile();
    const onToken = vi.fn();
    const { unmount } = render(TurnstileWidget, { onToken });

    await vi.waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    onToken.mockClear();

    unmount();

    // A stale token must not outlive the widget in parent state.
    expect(onToken).toHaveBeenCalledWith("");
    expect(api.remove).toHaveBeenCalledWith("widget-1");
  });

  it("does not render into a container unmounted while api.js was loading", async () => {
    mockEnv.env.PUBLIC_TURNSTILE_SITE_KEY = "site-key";
    // No window.turnstile yet, so loadTurnstile takes the <script>-injection
    // path — and jsdom never fetches the src, so the load stays pending until
    // we dispatch the event ourselves, after unmount.
    const api = {
      render: vi.fn<TurnstileApi["render"]>(() => "widget-1"),
      remove: vi.fn<TurnstileApi["remove"]>(),
      reset: vi.fn<TurnstileApi["reset"]>(),
    };

    const { unmount } = render(TurnstileWidget);
    const tag = await vi.waitFor(() => {
      const el = document.head.querySelector<HTMLScriptElement>(
        'script[src*="challenges.cloudflare.com"]',
      );
      expect(el).not.toBeNull();
      return el as HTMLScriptElement;
    });

    unmount();
    window.turnstile = api;
    tag.dispatchEvent(new Event("load"));
    // Let the now-resolved loader's .then settle after unmount.
    await new Promise((r) => setTimeout(r, 0));

    expect(api.render).not.toHaveBeenCalled();
    tag.remove();
  });
});
