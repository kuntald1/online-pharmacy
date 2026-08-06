export default function Button({ variant = "primary", className = "", ...props }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium px-4 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-teal text-white hover:bg-teal-dark",
    secondary: "bg-white text-ink border border-border hover:bg-bg",
    danger: "bg-red text-white hover:bg-red/90",
    ghost: "text-ink-soft hover:text-ink hover:bg-bg",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
