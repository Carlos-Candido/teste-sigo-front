import type { RoleKey } from "@/lib/accessControl";

type ProfileRole = Exclude<RoleKey, "unknown">;

export const profileTypeInfo: Record<ProfileRole, { label: string; description: string }> = {
  oficina: {
    label: "Oficina",
    description: "Gestão completa da oficina",
  },
  funcionario: {
    label: "Funcionário",
    description: "Operação conforme as permissões do cargo",
  },
  cliente: {
    label: "Cliente",
    description: "Acompanhamento dos próprios veículos e serviços",
  },
};

type ProfileTypeIconProps = {
  role: ProfileRole;
  className?: string;
};

function Gear({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M0-15v-6M0 15v6M15 0h6M-15 0h-6M10.6-10.6l4.2-4.2M-10.6 10.6l-4.2 4.2M10.6 10.6l4.2 4.2M-10.6-10.6l-4.2-4.2" />
      <circle cx="0" cy="0" r="15" />
      <circle cx="0" cy="0" r="5" />
    </g>
  );
}

export function ProfileTypeIcon({ role, className = "" }: ProfileTypeIconProps) {
  const commonProps = {
    "aria-hidden": true,
    className: `h-full w-full ${className}`.trim(),
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 4,
    viewBox: "0 0 120 120",
  };

  if (role === "oficina") {
    return (
      <svg {...commonProps}>
        <path d="M13 98h78V53L68 40v19L45 46v13L13 45v53Z" />
        <path d="M13 98h94M25 98V79h18v19M54 75h11M54 86h11M76 75h8M22 38V23h18v23" />
        <Gear x={92} y={35} scale={0.8} />
      </svg>
    );
  }

  if (role === "funcionario") {
    return (
      <svg {...commonProps}>
        <path d="M25 58c0-20 13-35 31-35s31 15 31 35" />
        <path d="M20 59h72M39 58V34M73 58V34" />
        <path d="M40 67c3 12 9 18 16 18s13-6 16-18M29 105c4-13 13-20 27-20 8 0 15 2 20 7" />
        <Gear x={91} y={89} scale={0.85} />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <circle cx="60" cy="36" r="19" />
      <path d="M22 104c3-25 16-38 38-38s35 13 38 38" />
      <path d="M37 91c7 6 15 9 23 9s16-3 23-9" />
    </svg>
  );
}
