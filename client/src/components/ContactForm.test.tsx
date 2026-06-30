import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContactForm from "./ContactForm";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from "sonner";

// The form's <select> elements have no htmlFor/id association with their
// <label>s, so they have no accessible name. We address them by document
// order, which matches the JSX render order: Budget, Bedrooms, Move-In,
// Area, Pets.
const SELECT_INDEX = {
  budget: 0,
  bedrooms: 1,
  moveIn: 2,
  area: 3,
  pets: 4,
} as const;

function getSelects() {
  return screen.getAllByRole("combobox") as HTMLSelectElement[];
}

describe("ContactForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders all four preference select fields with their labels and options", () => {
    render(<ContactForm />);

    // First duplicated pair: Budget & Bedrooms
    expect(screen.getByText("Monthly Budget")).toBeInTheDocument();
    expect(screen.getByText("Select budget")).toBeInTheDocument();
    expect(screen.getByText("$1,000 – $1,500")).toBeInTheDocument();

    expect(screen.getByText("Bedrooms")).toBeInTheDocument();
    expect(screen.getByText("Select bedrooms")).toBeInTheDocument();
    expect(screen.getByText("2 Bedrooms")).toBeInTheDocument();

    // Second duplicated pair: Move-In Timeline & Preferred Area
    expect(screen.getByText("Move-In Timeline")).toBeInTheDocument();
    expect(screen.getByText("Select timeline")).toBeInTheDocument();
    expect(screen.getByText("Within 30 days")).toBeInTheDocument();

    expect(screen.getByText("Preferred Area")).toBeInTheDocument();
    expect(screen.getByText("Select area")).toBeInTheDocument();
    expect(screen.getByText("The Heights")).toBeInTheDocument();

    expect(getSelects()).toHaveLength(5);
  });

  it("lets the user select a value in each of the four preference fields", async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    const selects = getSelects();
    await user.selectOptions(selects[SELECT_INDEX.budget], "$2,000 – $2,500");
    await user.selectOptions(selects[SELECT_INDEX.bedrooms], "2 Bedrooms");
    await user.selectOptions(selects[SELECT_INDEX.moveIn], "1–2 months");
    await user.selectOptions(selects[SELECT_INDEX.area], "The Heights");

    expect(selects[SELECT_INDEX.budget]).toHaveValue("$2,000 – $2,500");
    expect(selects[SELECT_INDEX.bedrooms]).toHaveValue("2 Bedrooms");
    expect(selects[SELECT_INDEX.moveIn]).toHaveValue("1–2 months");
    expect(selects[SELECT_INDEX.area]).toHaveValue("The Heights");
  });

  it("blocks submission via native HTML5 validation when required fields are empty", async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    // firstName/email/phone carry the `required` attribute, so the browser's
    // native constraint validation intercepts the submit before onSubmit
    // (and therefore the in-component validation/toast) ever runs.
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(global.fetch).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("John")).toBeInvalid();
  });

  it("shows an error toast when the API rejects a fully-filled submission", async () => {
    // With required fields satisfied, native HTML5 validation passes and
    // onSubmit runs. This exercises the catch-path toast (a sibling branch
    // to the missing-required-fields guard) together with all four
    // preference selects to confirm submission still works end-to-end when
    // the API call itself fails.
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Unable to send your information." }),
    });
    render(<ContactForm />);

    await user.type(screen.getByPlaceholderText("John"), "Jane");
    await user.type(screen.getByPlaceholderText("john@example.com"), "jane@example.com");
    await user.type(screen.getByPlaceholderText("(555) 123-4567"), "8326037278");

    const selects = getSelects();
    await user.selectOptions(selects[SELECT_INDEX.budget], "$2,000 – $2,500");
    await user.selectOptions(selects[SELECT_INDEX.bedrooms], "2 Bedrooms");
    await user.selectOptions(selects[SELECT_INDEX.moveIn], "1–2 months");
    await user.selectOptions(selects[SELECT_INDEX.area], "The Heights");

    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Unable to send your information.");
    });
  });

  it("submits successfully with required fields plus all four preference selections", async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.type(screen.getByPlaceholderText("John"), "Jane");
    await user.type(screen.getByPlaceholderText("john@example.com"), "jane@example.com");
    await user.type(screen.getByPlaceholderText("(555) 123-4567"), "8326037278");

    const selects = getSelects();
    await user.selectOptions(selects[SELECT_INDEX.budget], "$2,000 – $2,500");
    await user.selectOptions(selects[SELECT_INDEX.bedrooms], "2 Bedrooms");
    await user.selectOptions(selects[SELECT_INDEX.moveIn], "1–2 months");
    await user.selectOptions(selects[SELECT_INDEX.area], "The Heights");

    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const [, requestInit] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(requestInit.body as string);

    expect(body.budget).toBe("$2,000 – $2,500");
    expect(body.bedrooms).toBe("2 Bedrooms");
    expect(body.move_in_timeline).toBe("1–2 months");
    expect(body.preferred_area).toBe("The Heights");

    await waitFor(() => {
      expect(screen.getByText("Thank You!")).toBeInTheDocument();
    });
  });
});
