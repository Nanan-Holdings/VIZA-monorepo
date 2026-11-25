/** The VIZA wordmark in brand navy (public/assets/viza-logo-navy.svg, the drawn mark recoloured). */
export default function Logo({ className, height = 30, alt = "VIZA" }: { className?: string; height?: number; alt?: string }) {
  // Intrinsic size 375 x 111.
  const width = Math.round((height * 375) / 111);
  return <img className={className} src="/assets/viza-logo-navy.svg" alt={alt} width={width} height={height} />;
}
