"use client";

import { motion } from "motion/react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

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
          <p className={`font-medium leading-[1.5] not-italic relative shrink-0 text-[16px] tracking-[-0.24px] ${textColor ?? "text-[#3d3d3d]"}`}>
            {label}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function LucideSettings() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="lucide/settings-2">
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
      >
        <g id="lucide/settings-2">
          <path
            d="M9.33333 11.3333H3.33333M9.33333 11.3333C9.33333 12.4379 10.2288 13.3333 11.3333 13.3333C12.4379 13.3333 13.3333 12.4379 13.3333 11.3333C13.3333 10.2288 12.4379 9.33333 11.3333 9.33333C10.2288 9.33333 9.33333 10.2288 9.33333 11.3333ZM12.6667 4.66667H6.66667M6.66667 4.66667C6.66667 5.77124 5.77124 6.66667 4.66667 6.66667C3.5621 6.66667 2.66667 5.77124 2.66667 4.66667C2.66667 3.5621 3.5621 2.66667 4.66667 2.66667C5.77124 2.66667 6.66667 3.5621 6.66667 4.66667Z"
            id="Vector"
            stroke="var(--stroke-0, #3D3D3D)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.33"
          />
        </g>
      </svg>
    </div>
  );
}

function LucideInfo() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="lucide/info">
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
      >
        <g clipPath="url(#clip0_1_82)" id="lucide/info">
          <path
            d="M8 10.6667V8M8 5.33333H8.00667M14.6667 8C14.6667 11.6819 11.6819 14.6667 8 14.6667C4.3181 14.6667 1.33333 11.6819 1.33333 8C1.33333 4.3181 4.3181 1.33333 8 1.33333C11.6819 1.33333 14.6667 4.3181 14.6667 8Z"
            id="Vector"
            stroke="var(--stroke-0, #3D3D3D)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.33"
          />
        </g>
        <defs>
          <clipPath id="clip0_1_82">
            <rect fill="white" height="16" width="16" />
          </clipPath>
        </defs>
      </svg>
    </div>
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

export function AnimatedMenu({
  onLogout,
  isLoggingOut = false,
  showInviteFriends = false,
  onClose,
}: AnimatedMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("menu");
  const isInSettings = pathname.startsWith("/client/settings");
  const isInInviteFriends = pathname.startsWith("/client/invite-friends");
  const isInHelp = pathname.startsWith("/client/help");

  const handleSettings = () => {
    router.push("/client/settings");
    onClose?.();
  };

  const handleInviteFriends = () => {
    router.push("/client/invite-friends");
    onClose?.();
  };

  const handleHelp = () => {
    router.push("/client/help");
    onClose?.();
  };

  const menuItemBaseIndex = showInviteFriends ? 1 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="content-stretch flex flex-col gap-[8px] items-start p-[12px] relative rounded-[16px] w-56 bg-white"
    >
      <div
        aria-hidden="true"
        className="absolute border border-[#efefef] border-solid inset-0 pointer-events-none rounded-[16px] shadow-[0px_0px_8px_0px_rgba(171,171,171,0.25)]"
      />

      {showInviteFriends && (
        <>
          <MenuItem
            icon={<LucideUserPlus />}
            label={t("inviteFriends")}
            backgroundColor={isInInviteFriends ? "bg-[#efefef]" : "bg-white"}
            index={0}
            onClick={handleInviteFriends}
          />
        </>
      )}

      <MenuItem
        icon={<LucideSettings />}
        label={t("settings")}
        backgroundColor={isInSettings ? "bg-[#efefef]" : "bg-white"}
        index={menuItemBaseIndex}
        onClick={handleSettings}
      />

      <MenuItem
        icon={<LucideInfo />}
        label={t("help")}
        backgroundColor={isInHelp ? "bg-[#efefef]" : "bg-white"}
        index={menuItemBaseIndex + 1}
        onClick={handleHelp}
      />

      <div className="w-full h-px bg-[#efefef]" />

      <MenuItem
        icon={<LucideLogOut />}
        label={isLoggingOut ? t("loggingOut") : t("logout")}
        backgroundColor="bg-white"
        index={menuItemBaseIndex + 2}
        onClick={onLogout}
        textColor="text-red-500"
      />
    </motion.div>
  );
}
