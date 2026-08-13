"use client";

import { motion } from "motion/react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Globe, Question as CircleQuestionMark, SignOut, UserPlus } from "@phosphor-icons/react";

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

interface AnimatedMenuProps {
  onLogout: () => void | Promise<void>;
  isLoggingOut?: boolean;
  showInviteFriends?: boolean;
  onClose?: () => void;
}

// Home / Application / Settings live in the top nav bar — the dropdown carries
// everything else, including the applications index and help centre.
export function AnimatedMenu({
  onLogout,
  isLoggingOut = false,
  showInviteFriends = false,
  onClose,
}: AnimatedMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("menu");
  // The change-country picker now lives on the applications index.
  const isInDestinations =
    pathname.startsWith("/client/destinations") || pathname.startsWith("/client/status");
  const isInInviteFriends = pathname.startsWith("/client/invite-friends");
  const isInHelp = pathname.startsWith("/client/help");

  const navigate = (href: string) => {
    router.push(href);
    onClose?.();
  };

  // Switch application is index 0; invite-friends (when shown) takes index 1,
  // then help, then logout.
  const helpIndex = showInviteFriends ? 2 : 1;

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
        onClick={() => navigate("/client/status")}
      />

      {showInviteFriends && (
        <MenuItem
          icon={<UserPlus className="size-4" />}
          label={t("inviteFriends")}
          backgroundColor={isInInviteFriends ? "bg-[#efefef]" : "bg-white"}
          index={1}
          onClick={() => navigate("/client/invite-friends")}
        />
      )}

      <MenuItem
        icon={<CircleQuestionMark className="h-4 w-4" />}
        label={t("help")}
        backgroundColor={isInHelp ? "bg-[#efefef]" : "bg-white"}
        index={helpIndex}
        onClick={() => navigate("/client/help")}
      />

      <div className="w-full h-px bg-[#efefef]" />

      <MenuItem
        icon={<SignOut className="size-4 text-red-500" />}
        label={isLoggingOut ? t("loggingOut") : t("logout")}
        backgroundColor="bg-white"
        index={helpIndex + 1}
        onClick={onLogout}
        textColor="text-red-500"
      />
    </motion.div>
  );
}
