import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileTypeIcon, profileTypeInfo } from "@/components/Profile/ProfileTypeIcon";

describe("ProfileTypeIcon", () => {
  it.each(["cliente", "funcionario", "oficina"] as const)(
    "renderiza o símbolo vetorial do perfil %s",
    (role) => {
      const { container } = render(<ProfileTypeIcon role={role} />);
      expect(container.querySelector("svg")).toBeInTheDocument();
      expect(profileTypeInfo[role].label).toBeTruthy();
    }
  );
});
