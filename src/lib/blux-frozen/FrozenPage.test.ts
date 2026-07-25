import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import FrozenPage from "./FrozenPage.svelte";

afterEach(() => cleanup());

describe("FrozenPage", () => {
  it("substitutes text + background-image slots, leaks no token", () => {
    const { container } = render(FrozenPage, {
      props: {
        template: `<div class="frozen-root"><h1>⟦t:s0.t0⟧</h1><div class="bg" style="background-image:url(⟦i:s0.i0⟧)"></div></div>`,
        styleCss: ".x{color:red}",
        fontLinks: [],
        slots: [
          { key: "s0.t0", kind: "text", text: "Distinguished Design" },
          { key: "s0.i0", kind: "image", url: "https://img.prismic.io/x.jpg" },
        ],
      },
    });
    expect(container.querySelector("h1")?.textContent).toBe(
      "Distinguished Design",
    );
    expect(container.querySelector(".bg")?.getAttribute("style")).toContain(
      "url('https://img.prismic.io/x.jpg')",
    );
    expect(container.innerHTML).not.toContain("⟦");
  });

  it("renders missing slots as empty without leaving a raw token", () => {
    const { container } = render(FrozenPage, {
      props: {
        template: `<div class="frozen-root"><p>⟦t:absent⟧</p></div>`,
        styleCss: "",
        slots: [],
      },
    });
    expect(container.innerHTML).not.toContain("⟦");
  });
});
