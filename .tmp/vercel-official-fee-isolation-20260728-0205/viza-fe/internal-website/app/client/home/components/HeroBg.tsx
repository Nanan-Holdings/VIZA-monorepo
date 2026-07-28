export function HeroBg() {
  return (
    <div className="absolute content-stretch flex h-[538px] items-start left-1/2 overflow-clip top-0 translate-x-[-50%] w-[1440px]" data-name="hero bg">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div className="absolute bg-gradient-to-b from-[#af714d] inset-0 to-[#e9c5b1] to-[151.33%]" />
        <div className="absolute bg-[rgba(0,0,0,0.03)] inset-0 mix-blend-hard-light" />
      </div>
      <div className="absolute blur-lg filter h-[496px] left-[386px] top-[52px] w-[744px]" data-name="hero-main 2">
        <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full" src="/figma-assets/hero-background.png" />
      </div>
    </div>
  );
}
