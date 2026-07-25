import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import BandTitle from "./BandTitle.svelte";

afterEach(() => cleanup());

describe("BandTitle", () => {
  it("renders eyebrow + display line with roles from the manifest text metadata", () => {
    const { container } = render(BandTitle, {
      props: {
        heading: "the space",
        subtitle: "distinguished\ndesign",
        text: { headingRole: "text5", headingLevel: 2, subtitleRole: "text12" },
      },
    });
    const eyebrow = container.querySelector("p");
    expect(eyebrow?.textContent).toContain("the space");
    expect(eyebrow?.className).toContain("txt-role-text5");
    // The visually-dominant display line is the semantic <h2>, source hard
    // line breaks preserved.
    const h2 = container.querySelector("h2");
    expect(h2?.className).toContain("txt-role-text12");
    expect(h2?.innerHTML).toContain("<br");
    expect(h2?.textContent).toContain("distinguished");
  });

  it("renders a heading-only band at the source heading level with its role", () => {
    const { container } = render(BandTitle, {
      props: {
        heading: "Come Be A Part Of It.",
        text: { headingRole: "text11", headingLevel: 2 },
      },
    });
    const h2 = container.querySelector("h2");
    expect(h2?.textContent).toContain("Come Be A Part Of It.");
    expect(h2?.className).toContain("txt-role-text11");
  });

  it("defaults the heading-only level to h2 and clamps out-of-range levels", () => {
    const noMeta = render(BandTitle, { props: { heading: "CTA" } });
    expect(noMeta.container.querySelector("h2")).not.toBeNull();

    const deep = render(BandTitle, {
      props: { heading: "Deep", text: { headingLevel: 9 } },
    });
    expect(deep.container.querySelector("h6")).not.toBeNull();
  });

  it("applies no txt-role class when the manifest carries no roles", () => {
    const { container } = render(BandTitle, {
      props: { heading: "eyebrow", subtitle: "display" },
    });
    expect(container.querySelector("p")?.className).not.toContain("txt-role-");
    expect(container.querySelector("h2")?.className).not.toContain("txt-role-");
  });

  it("renders nothing without heading or subtitle", () => {
    const { container } = render(BandTitle, { props: {} });
    expect(container.querySelector("h2")).toBeNull();
    expect(container.querySelector("p")).toBeNull();
  });
});
