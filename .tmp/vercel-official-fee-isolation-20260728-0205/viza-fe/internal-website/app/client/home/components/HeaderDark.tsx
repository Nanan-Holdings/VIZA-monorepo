import { motion } from "motion/react";

interface HeaderDarkProps {
  userName: string | null;
}

function TabItem() {
  return (
    <div className="bg-[rgba(255,255,255,0.15)] flex items-center justify-center px-[24px] py-[12px] relative rounded-[999px] cursor-pointer hover:bg-[rgba(255,255,255,0.2)] transition-colors">
      <p className="font-['Sofia_Pro:Medium',sans-serif] leading-[1.6] text-[16px] text-white">Home</p>
    </div>
  );
}

function TabItem1() {
  return (
    <div className="flex items-center justify-center px-[24px] py-[12px] relative rounded-[999px] cursor-pointer hover:bg-[rgba(255,255,255,0.1)] transition-colors">
      <p className="font-['Sofia_Pro:Medium',sans-serif] leading-[1.6] text-[16px] text-[rgba(255,255,255,0.5)]">Data</p>
    </div>
  );
}

function TabItem2() {
  return (
    <div className="flex items-center justify-center px-[24px] py-[12px] relative rounded-[999px] cursor-pointer hover:bg-[rgba(255,255,255,0.1)] transition-colors">
      <p className="font-['Sofia_Pro:Medium',sans-serif] leading-[1.6] text-[16px] text-[rgba(255,255,255,0.5)]">Records</p>
    </div>
  );
}

function TabItem3() {
  return (
    <div className="flex items-center justify-center px-[24px] py-[12px] relative rounded-[999px] cursor-pointer hover:bg-[rgba(255,255,255,0.1)] transition-colors">
      <p className="font-['Sofia_Pro:Medium',sans-serif] leading-[1.6] text-[16px] text-[rgba(255,255,255,0.5)]">Concierge</p>
    </div>
  );
}

function TabItem4() {
  return (
    <div className="flex items-center justify-center px-[24px] py-[12px] relative rounded-[999px] cursor-pointer hover:bg-[rgba(255,255,255,0.1)] transition-colors">
      <p className="font-['Sofia_Pro:Medium',sans-serif] leading-[1.6] text-[16px] text-[rgba(255,255,255,0.5)]">About you</p>
    </div>
  );
}

function LabsPageTabs() {
  return (
    <div className="bg-[rgba(0,0,0,0.35)] flex gap-[4px] items-center p-[4px] relative rounded-[999px]">
      <TabItem />
      <TabItem1 />
      <TabItem2 />
      <TabItem3 />
      <TabItem4 />
    </div>
  );
}

function Menu() {
  return (
    <div className="flex gap-[12px] items-center p-[8px] relative cursor-pointer hover:opacity-80 transition-opacity">
      <p className="font-['Sofia_Pro:Medium',sans-serif] leading-[1.6] text-[16px] text-white">Invite Friends</p>
    </div>
  );
}

function LucideMenu() {
  return (
    <div className="relative shrink-0 size-[20px]">
      <svg className="block size-full" fill="none" viewBox="0 0 20 20">
        <g id="lucide/menu">
          <path d="M2 5H18M2 10H18M2 15H18" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.33" />
        </g>
      </svg>
    </div>
  );
}

function Menu1() {
  return (
    <div className="flex gap-[12px] items-center p-[8px] relative cursor-pointer hover:opacity-80 transition-opacity">
      <LucideMenu />
    </div>
  );
}

function Frame1() {
  return (
    <div className="flex gap-[16px] items-center justify-end relative">
      <Menu />
    </div>
  );
}

function Frame2() {
  return (
    <div className="flex gap-[225px] items-center max-w-[1312px] relative w-[1312px]">
      <div className="h-[29px] relative w-[160px]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img alt="VIZA Logo" className="absolute h-full left-[0.08%] w-[89.09%]" src="/logo/viza-logo-white.svg" />
        </div>
      </div>
      <LabsPageTabs />
      <Frame1 />
    </div>
  );
}

export function HeaderDark({ userName }: HeaderDarkProps) {
  return (
    <motion.div 
      className="absolute backdrop-blur-[0px] bg-[rgba(255,255,255,0)] flex h-[83px] items-center justify-between left-1/2 px-0 py-[20px] top-0 translate-x-[-50%] w-[1440px]" 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Frame2 />
    </motion.div>
  );
}
