"use client"

import React, {
  createContext,
  forwardRef,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  motion,
  type MotionProps,
  type MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react"

import { cn } from "@/lib/utils"

export interface DockProps extends VariantProps<typeof dockVariants> {
  className?: string
  iconSize?: number
  iconMagnification?: number
  disableMagnification?: boolean
  iconDistance?: number
  direction?: "top" | "middle" | "bottom"
  children?: ReactNode
}

const DEFAULT_SIZE = 40
const DEFAULT_MAGNIFICATION = 60
const DEFAULT_DISTANCE = 140
const DEFAULT_DISABLEMAGNIFICATION = false

const dockVariants = cva(
  "supports-backdrop-blur:bg-white/10 supports-backdrop-blur:dark:bg-black/10 mx-auto mt-8 flex h-[58px] w-max items-center justify-center gap-2 rounded-2xl border p-2 backdrop-blur-md"
)

interface DockContextValue {
  mouseX: MotionValue<number>
  iconSize: number
  iconMagnification: number
  disableMagnification: boolean
  iconDistance: number
}

const DockContext = createContext<DockContextValue | null>(null)

const Dock = forwardRef<HTMLDivElement, DockProps>(
  (
    {
      className,
      children,
      iconSize = DEFAULT_SIZE,
      iconMagnification = DEFAULT_MAGNIFICATION,
      disableMagnification = DEFAULT_DISABLEMAGNIFICATION,
      iconDistance = DEFAULT_DISTANCE,
      direction = "middle",
      ...props
    },
    ref
  ) => {
    const mouseX = useMotionValue(Infinity)

    const value = useMemo(
      () => ({
        mouseX,
        iconSize,
        iconMagnification,
        disableMagnification,
        iconDistance,
      }),
      [mouseX, iconSize, iconMagnification, disableMagnification, iconDistance]
    )

    return (
      <DockContext.Provider value={value}>
        <motion.div
          ref={ref}
          onMouseMove={(e) => mouseX.set(e.clientX)}
          onMouseLeave={() => mouseX.set(Infinity)}
          {...props}
          className={cn(dockVariants({ className }), {
            "items-start": direction === "top",
            "items-center": direction === "middle",
            "items-end": direction === "bottom",
          })}
        >
          {children}
        </motion.div>
      </DockContext.Provider>
    )
  }
)

Dock.displayName = "Dock"

export interface DockIconProps
  extends Omit<MotionProps & React.HTMLAttributes<HTMLDivElement>, "children"> {
  size?: number
  magnification?: number
  disableMagnification?: boolean
  distance?: number
  className?: string
  children?: ReactNode
}

const DockIcon = ({
  size,
  magnification,
  disableMagnification,
  distance,
  className,
  children,
  ...props
}: DockIconProps) => {
  const context = useContext(DockContext)
  const localMouseX = useMotionValue(Infinity)
  const ref = useRef<HTMLDivElement>(null)

  const mouseX = context?.mouseX ?? localMouseX
  const effectiveSize = size ?? context?.iconSize ?? DEFAULT_SIZE
  const effectiveMagnification =
    magnification ?? context?.iconMagnification ?? DEFAULT_MAGNIFICATION
  const effectiveDisable =
    disableMagnification ?? context?.disableMagnification ?? DEFAULT_DISABLEMAGNIFICATION
  const effectiveDistance = distance ?? context?.iconDistance ?? DEFAULT_DISTANCE

  const padding = Math.max(6, effectiveSize * 0.2)

  const distanceCalc = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 }
    return val - bounds.x - bounds.width / 2
  })

  const targetSize = effectiveDisable ? effectiveSize : effectiveMagnification

  const sizeTransform = useTransform(
    distanceCalc,
    [-effectiveDistance, 0, effectiveDistance],
    [effectiveSize, targetSize, effectiveSize]
  )

  const scaleSize = useSpring(sizeTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  })

  return (
    <motion.div
      ref={ref}
      style={{ width: scaleSize, height: scaleSize, padding }}
      className={cn(
        "flex aspect-square cursor-pointer items-center justify-center rounded-full",
        effectiveDisable && "hover:bg-muted-foreground transition-colors",
        className
      )}
      {...props}
    >
      <div>{children}</div>
    </motion.div>
  )
}

DockIcon.displayName = "DockIcon"

export { Dock, DockIcon, dockVariants }