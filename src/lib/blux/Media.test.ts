import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import Media from "./Media.svelte";

// jsdom has no matchMedia; the component queries prefers-reduced-motion.
const mockMatchMedia = (reduce: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
};

beforeEach(() => mockMatchMedia(false));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Media", () => {
  it("renders an <img loading=lazy> for kind image with alt defaulting empty", () => {
    const { container } = render(Media, {
      props: { media: { kind: "image", url: "https://cdn/x.jpg" } },
    });
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn/x.jpg");
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(img?.getAttribute("alt")).toBe("");
    expect(container.querySelector("video")).toBeNull();
  });

  it("renders loading=eager on the <img> when told (LCP images)", () => {
    const { container } = render(Media, {
      props: {
        media: { kind: "image", url: "https://cdn/x.jpg" },
        loading: "eager",
      },
    });
    expect(container.querySelector("img")?.getAttribute("loading")).toBe(
      "eager",
    );
  });

  it("renders no style at all when the media carries no sizing or fit hints", () => {
    const { container } = render(Media, {
      props: { media: { kind: "image", url: "https://cdn/x.jpg" } },
    });
    expect(container.querySelector("img")?.getAttribute("style")).toBeNull();
  });

  it("fit 'auto' renders object-fit:none (native-size decorative accent)", () => {
    const { container } = render(Media, {
      props: {
        media: { kind: "image", url: "https://cdn/accent.png", fit: "auto" },
      },
    });
    const img = container.querySelector("img") as HTMLElement;
    expect(img.style.getPropertyValue("object-fit")).toBe("none");
  });

  it("passes fit 'cover' and the source position through", () => {
    const { container } = render(Media, {
      props: {
        media: {
          kind: "image",
          url: "https://cdn/bg.jpg",
          fit: "cover",
          position: "right bottom",
        },
      },
    });
    const img = container.querySelector("img") as HTMLElement;
    expect(img.style.getPropertyValue("object-fit")).toBe("cover");
    expect(img.style.getPropertyValue("object-position")).toBe("right bottom");
  });

  it("renders an ambient <video> for kind video (muted, loop, playsinline, autoplay, metadata)", () => {
    const { container } = render(Media, {
      props: { media: { kind: "video", url: "https://cdn/x.mp4" } },
    });
    const video = container.querySelector("video");
    expect(video?.getAttribute("src")).toBe("https://cdn/x.mp4");
    expect(video?.hasAttribute("autoplay")).toBe(true);
    expect(video?.hasAttribute("loop")).toBe(true);
    expect(video?.hasAttribute("playsinline")).toBe(true);
    expect(video?.getAttribute("preload")).toBe("metadata");
    // muted is a property, not always reflected as an attribute
    expect((video as HTMLVideoElement).muted).toBe(true);
  });

  it("honors source playback attrs — a controls video is user-initiated, not an autoplay loop", () => {
    const { container } = render(Media, {
      props: {
        media: {
          kind: "video",
          url: "https://cdn/x.mp4",
          playback: { controls: true, playsinline: true },
        },
      },
    });
    const video = container.querySelector("video");
    expect(video?.hasAttribute("controls")).toBe(true);
    expect(video?.hasAttribute("autoplay")).toBe(false);
    expect(video?.hasAttribute("loop")).toBe(false);
    expect(video?.hasAttribute("playsinline")).toBe(true);
  });

  it("pauses the ambient video when prefers-reduced-motion is reduce", () => {
    mockMatchMedia(true);
    // jsdom media elements don't really play; observe the pause() call.
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => {});
    const { container } = render(Media, {
      props: { media: { kind: "video", url: "https://cdn/x.mp4" } },
    });
    const video = container.querySelector("video") as HTMLVideoElement;
    expect(pause).toHaveBeenCalled();
    expect(video.paused).toBe(true);
  });
});
