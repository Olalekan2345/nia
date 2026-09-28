import { cn } from "@nia/ui";
import { initials } from "@nia/shared";

/** Merchant logo, or initials on the merchant's accent colour. */
export function MerchantMark({ name, logoUrl, accent, size = 36, className }: { name: string; logoUrl?: string | null; accent: string; size?: number; className?: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" width={size} height={size} className={cn("shrink-0 rounded-xl object-cover", className)} style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center rounded-xl font-bold text-white", className)}
      // Merchant-configured brand colour (white initials; accent colours are validated as dark enough in settings).
      style={{ width: size, height: size, background: accent, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}
