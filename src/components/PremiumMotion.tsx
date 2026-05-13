import { ReactNode, useState } from "react";
import { motion, type HTMLMotionProps, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

type RevealProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  delay?: number;
};

export const Reveal = ({ children, delay = 0, className, ...props }: RevealProps) => (
  <motion.div
    variants={revealVariants}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
    className={className}
    {...props}
  >
    {children}
  </motion.div>
);

type StaggerProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
};

export const Stagger = ({ children, className, ...props }: StaggerProps) => (
  <motion.div
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: "-80px" }}
    variants={{
      hidden: {},
      visible: { transition: { staggerChildren: 0.08 } },
    }}
    className={className}
    {...props}
  >
    {children}
  </motion.div>
);

type PremiumTiltCardProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
};

export const PremiumTiltCard = ({ children, className, ...props }: PremiumTiltCardProps) => {
  const [transform, setTransform] = useState("perspective(900px) rotateX(0deg) rotateY(0deg)");

  return (
    <motion.div
      variants={revealVariants}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const rotateY = ((x / rect.width) - 0.5) * 7;
        const rotateX = ((0.5 - y / rect.height) * 7);
        setTransform(`perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`);
      }}
      onMouseLeave={() => setTransform("perspective(900px) rotateX(0deg) rotateY(0deg)")}
      style={{ transform }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
      className={cn("premium-card premium-card-hover", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
};
