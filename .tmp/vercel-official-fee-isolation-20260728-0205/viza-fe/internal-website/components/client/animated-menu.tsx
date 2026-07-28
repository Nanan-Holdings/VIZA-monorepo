"use client";

import { motion } from "motion/react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Globe } from "lucide-react";

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  backgroundColor: string;
  index: number;
  onClick?: () => void;
  textColor?: string;
}

function MenuItem({
  icon,
  label,
  backgroundColor,
  index,
  onClick,
  textColor,
}: MenuItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.3,
        delay: index * 0.1,
        ease: "easeOut",
      }}
      whileHover={{
        scale: 1.02,
        transition: { duration: 0.2 },
      }}
      whileTap={{ scale: 0.98 }}
      className={`${backgroundColor} relative rounded-[8px] shrink-0 w-full cursor-pointer`}
      onClick={onClick}
    >
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[12px] items-center p-[12px] relative w-full">
          <motion.div whileHover={{ rotate: 360 }} transition={{ duration: 0.5 }}>
            {icon}
          </motion.div>
          <p className={`min-w-0 truncate font-medium leading-[1.5] not-italic relative text-[16px] tracking-[-0.24px] ${textColor ?? "text-[#3d3d3d]"}`}>
            {label}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function LucideLogOut() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="lucide/log-out">
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
      >
        <g id="lucide/log-out">
          <path
            d="M10.6667 11.3333L14 8M14 8L10.6667 4.66667M14 8H6M6 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V3.33333C2 2.97971 2.14048 2.64057 2.39052 2.39052C2.64057 2.14048 2.97971 2 3.33333 2H6"
            id="Vector"
            stroke="#ef4444"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.33"
          />
        </g>
      </svg>
    </div>
  );
}

function LucideUserPlus() {
  return (
    <div className="relative shrink-0 size-[16px]">
      <svg className="block size-full" fill="none" viewBox="0 0 16 16">
        <path
          d="M10.667 14v-1.333A2.667 2.667 0 008 10H4a2.667 2.667 0 00-2.667 2.667V14M6 7.333A2.667 2.667 0 106 2a2.667 2.667 0 000 5.333zM13.333 5.333v4M15.333 7.333h-4"
          stroke="var(--stroke-0, #3D3D3D)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.33"
        />
      </svg>
    </div>
  );
}

interface AnimatedMenuProps {
  onLogout: () => void | Promise<void>;
  isLoggingOut?: boolean;
  showInviteFriends?: boolean;
  onClose?: () => void;
}

// Status / Application / Settings / Support live in the top nav bar — the
// dropdown only carries destinations that have no nav tab.
export function AnimatedMenu({
  onLogout,
  isLoggingOut = false,
  showInviteFriends = false,
  onClose,
}: AnimatedMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("menu");
  const isInDestinations = pathname.startsWith("/client/destinations");
  const isInInviteFriends = pathname.startsWith("/client/invite-friends");

  const handleChangeCountry = () => {
    router.push("/client/destinations");
    onClose?.();
  };

  const handleInviteFriends = () => {
    router.push("/client/invite-friends");
    onClose?.();
  };

  // Index 0 = switch-country item; invite-friends (when shown) takes index 1.
  const menuItemBaseIndex = showInviteFriends ? 1 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="content-stretch flex flex-col gap-[8px] items-start p-[12px] relative rounded-[16px] w-64 max-w-[calc(100vw-2rem)] bg-white"
    >
      <div
        aria-hidden="true"
        className="absolute border border-[#efefef] border-solid inset-0 pointer-events-none rounded-[16px] shadow-[0px_0px_8px_0px_rgba(171,171,171,0.25)]"
      />

      <MenuItem
        icon={<Globe className="h-4 w-4" />}
        label={t("changeCountry")}
        backgroundColor={isInDestinations ? "bg-[#efefef]" : "bg-white"}
        index={0}
        onClick={handleChangeCountry}
      />

      {showInviteFriends && (
        <>
          <MenuItem
            icon={<LucideUserPlus />}
            label={t("inviteFriends")}
            backgroundColor={isInInviteFriends ? "bg-[#efefef]" : "bg-white"}
            index={1}
            onClick={handleInviteFriends}
          />
        </>
      )}

      <div className="w-full h-px bg-[#efefef]" />

      <MenuItem
        icon={<LucideLogOut />}
        label={isLoggingOut ? t("loggingOut") : t("logout")}
        backgroundColor="bg-white"
        index={menuItemBaseIndex + 1}
        onClick={onLogout}
        textColor="text-red-500"
      />
    </motion.div>
  );
}
