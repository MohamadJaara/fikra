import Link from "next/link";

export function UserLink({
  handle,
  name,
  className,
  children,
}: {
  handle?: string;
  name?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  if (!handle) {
    return <span className={className}>{children ?? name}</span>;
  }
  return (
    <Link
      href={`/product/profile/${handle}`}
      className={`hover:underline hover:text-primary transition-colors ${className || ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      {children ?? name}
    </Link>
  );
}

export function UserAvatar({
  handle,
  image,
  name,
  size = "sm",
}: {
  handle?: string;
  image?: string;
  name?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "h-5 w-5",
    md: "h-7 w-7",
    lg: "h-10 w-10",
  };
  const sizeTextClasses = {
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-sm",
  };
  const containerCls = `rounded-full bg-muted flex items-center justify-center font-medium shrink-0 ${sizeClasses[size]} ${sizeTextClasses[size]}`;
  const imgCls = `rounded-full object-cover ${sizeClasses[size]}`;

  const inner = image ? (
    <img src={image} alt="" className={imgCls} />
  ) : (
    <div className={containerCls}>{name?.charAt(0)?.toUpperCase() || "?"}</div>
  );

  if (!handle) return inner;
  return (
    <Link
      href={`/product/profile/${handle}`}
      onClick={(e) => e.stopPropagation()}
    >
      {inner}
    </Link>
  );
}
