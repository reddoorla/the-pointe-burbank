import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import Form from "./Form.svelte";

afterEach(() => cleanup());

describe("Form", () => {
  it("does not render a summary when there are no errors", () => {
    const { queryByRole } = render(Form);
    expect(queryByRole("alert")).toBeNull();
  });

  it("renders an error summary when errors are present", () => {
    const { getByRole, getByText } = render(Form, {
      errors: { email: "Email is required", message: "Message too short" },
    });
    const alert = getByRole("alert");
    expect(alert).toBeTruthy();
    expect(getByText("Email is required")).toBeTruthy();
    expect(getByText("Message too short")).toBeTruthy();
  });

  it("error summary is focusable for screen-reader announcement", () => {
    const { getByRole } = render(Form, {
      errors: { email: "Required" },
    });
    const alert = getByRole("alert");
    expect(alert.getAttribute("tabindex")).toBe("-1");
  });
});
