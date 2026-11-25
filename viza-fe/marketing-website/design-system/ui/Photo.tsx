import Image from "next/image";

type Props = {
  src: string;
  alt?: string;
  /** next/image sizes hint, for example "(max-width: 809px) 100vw, 33vw". */
  sizes: string;
  className?: string;
  priority?: boolean;
};

/** A rounded photo that fills its box (the box sets the size or aspect ratio in CSS). */
export default function Photo({ src, alt = "", sizes, className, priority }: Props) {
  return (
    <div className={["ds-photo", className].filter(Boolean).join(" ")}>
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} />
    </div>
  );
}
