import { motion } from "framer-motion";

export const Greeting = () => {
  return (
    <div
      className="flex flex-col items-center px-4 mt-24 md:mt-32"
      key="overview"
    >
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center font-semibold text-2xl tracking-tight text-foreground md:text-3xl"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.35, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        旅行规划助手
      </motion.div>

      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 text-center text-muted-foreground/80 text-sm"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        我会按顺序问你目的地、城市、天数、人数和预算，然后生成结构化行程。
      </motion.div>
    </div>
  );
};