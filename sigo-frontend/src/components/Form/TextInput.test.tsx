import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TextInput } from "@/components/Form/TextInput";

describe("TextInput", () => {
  it("alterna a visibilidade da senha de forma acessível", async () => {
    const user = userEvent.setup();
    render(
      <TextInput
        id="password"
        label="Senha"
        value="Senha123"
        onChange={() => undefined}
        type="password"
        showPasswordToggle
      />
    );

    const input = screen.getByLabelText("Senha");
    expect(input).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar senha" })).toHaveAttribute("aria-pressed", "true");
  });
});
