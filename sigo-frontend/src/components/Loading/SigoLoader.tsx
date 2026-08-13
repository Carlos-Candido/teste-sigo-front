type SigoLoaderProps = {
  label?: string;
  compact?: boolean;
  dark?: boolean;
};

export function SigoLoader({
  label = "Carregando...",
  compact = false,
  dark = false,
}: SigoLoaderProps) {
  return (
    <div
      className={`sigo-loader ${compact ? "sigo-loader-compact" : ""} ${
        dark ? "sigo-loader-dark" : ""
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="sigo-loader-mark" aria-hidden="true">
        <img
          src="/sigo-logo-engrenagem.png"
          alt=""
          className="sigo-loader-gear"
        />
        <img
          src="/sigo-logo-texto.png"
          alt=""
          className="sigo-loader-text"
        />
      </div>
      <span className="sigo-loader-label">{label}</span>
    </div>
  );
}
