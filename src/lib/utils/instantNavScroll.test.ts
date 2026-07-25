import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { disableSmoothScroll, restoreSmoothScroll } from "./instantNavScroll";
import type { AfterNavigate, BeforeNavigate } from "@sveltejs/kit";

const afterNav = (type: AfterNavigate["type"]) => ({ type }) as AfterNavigate;

let rafSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  document.documentElement.style.scrollBehavior = "";
  rafSpy = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
});

afterEach(() => {
  rafSpy.mockRestore();
});

describe("instantNavScroll", () => {
  it("never scrolls on its own — kit owns the scroll target (hash/noscroll/popstate safety)", () => {
    const scrollSpy = vi.spyOn(window, "scrollTo");
    disableSmoothScroll({} as BeforeNavigate);
    restoreSmoothScroll(afterNav("link"));
    expect(scrollSpy).not.toHaveBeenCalled();
    scrollSpy.mockRestore();
  });

  it("flips scroll-behavior to auto before navigation so kit's scroll is instant", () => {
    disableSmoothScroll({} as BeforeNavigate);
    expect(document.documentElement.style.scrollBehavior).toBe("auto");
  });

  it("restores the inline style a frame after navigation completes", () => {
    disableSmoothScroll({} as BeforeNavigate);
    restoreSmoothScroll(afterNav("link"));
    expect(document.documentElement.style.scrollBehavior).toBe("");
  });

  it("restores after popstate too — back/forward restore should also be instant", () => {
    disableSmoothScroll({} as BeforeNavigate);
    restoreSmoothScroll(afterNav("popstate"));
    expect(document.documentElement.style.scrollBehavior).toBe("");
  });

  it("does nothing on initial load (enter): nothing was disabled", () => {
    restoreSmoothScroll(afterNav("enter"));
    expect(rafSpy).not.toHaveBeenCalled();
  });
});
