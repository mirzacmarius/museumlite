"use client";

import { Slot } from "@radix-ui/react-slot";
import { Button } from "@v1/ui/button";
import { usePlatform } from "@v1/ui/hooks";
import { useIsMobile } from "@v1/ui/hooks/use-mobile";
import { Input } from "@v1/ui/input";
import { useUiLocale } from "@v1/ui/locale";
import { Separator } from "@v1/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@v1/ui/sheet";
import { Skeleton } from "@v1/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import { cn } from "@v1/ui/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { springValue, useReducedMotion } from "framer-motion";
import { PanelLeft } from "lucide-react";
import * as React from "react";
import { SPRING } from "./motion";

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = "14rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarContextProps = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

function useSidebar() {
  const context = React.use(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

const SidebarProvider = ({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ref,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} & React.RefAttributes<HTMLDivElement>) => {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = React.useState(() => defaultOpen);
  const open = openProp ?? _open;
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value;
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        _setOpen(openState);
      }

      // Cookie Store API lacks broad browser support; document.cookie persists sidebar state.
      // biome-ignore lint/suspicious/noDocumentCookie: intentional fallback until Cookie Store is viable
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [setOpenProp, open],
  );

  // Helper to toggle the sidebar.
  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open);
  }, [isMobile, setOpen, setOpenMobile]);

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? "expanded" : "collapsed";

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            "group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-sidebar",
            className,
          )}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
};
SidebarProvider.displayName = "SidebarProvider";

const Sidebar = ({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ref,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
} & React.RefAttributes<HTMLDivElement>) => {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();
  const { messages } = useUiLocale();

  if (collapsible === "none") {
    return (
      <div
        className={cn(
          "flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground",
          className,
        )}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          data-sidebar="sidebar"
          data-mobile="true"
          className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side={side}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{messages.sidebar.title}</SheetTitle>
            <SheetDescription>{messages.sidebar.description}</SheetDescription>
          </SheetHeader>
          <div className="flex size-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      ref={ref}
      className="group peer hidden text-sidebar-foreground md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        className={cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
        )}
      />
      <div
        className={cn(
          "fixed inset-y-0 z-30 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          // Adjust the padding for floating and inset variants.
          variant === "floating" || variant === "inset"
            ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4)_+2px)]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          className="flex size-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow"
        >
          {children}
        </div>
      </div>
    </div>
  );
};
Sidebar.displayName = "Sidebar";

const SidebarTrigger = ({
  className,
  onClick,
  ref,
  ...props
}: React.ComponentProps<typeof Button> &
  React.RefAttributes<React.ElementRef<typeof Button>>) => {
  const { toggleSidebar } = useSidebar();
  const { isMac } = usePlatform();
  const { messages } = useUiLocale();

  const shortcutText = isMac ? "⌘B" : "Ctrl+B";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={ref}
          data-sidebar="trigger"
          variant="ghost"
          size="icon"
          className={cn("size-7", className)}
          onClick={(event) => {
            onClick?.(event);
            toggleSidebar();
          }}
          {...props}
        >
          <PanelLeft />
          <span className="sr-only">{messages.sidebar.toggle}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {messages.sidebar.toggle} ({shortcutText})
        </p>
      </TooltipContent>
    </Tooltip>
  );
};
SidebarTrigger.displayName = "SidebarTrigger";

const SidebarRail = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"button"> & React.RefAttributes<HTMLButtonElement>) => {
  const { toggleSidebar } = useSidebar();
  const { isMac } = usePlatform();
  const { messages } = useUiLocale();

  const shortcutText = isMac ? "⌘B" : "Ctrl+B";

  return (
    <button
      ref={ref}
      data-sidebar="rail"
      aria-label={messages.sidebar.toggle}
      tabIndex={-1}
      onClick={toggleSidebar}
      title={`${messages.sidebar.toggle} (${shortcutText})`}
      className={cn(
        "absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex",
        "[[data-side=left]_&]:cursor-w-resize [[data-side=right]_&]:cursor-e-resize",
        "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full group-data-[collapsible=offcanvas]:hover:bg-sidebar",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className,
      )}
      {...props}
    />
  );
};
SidebarRail.displayName = "SidebarRail";

const SidebarInset = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"main"> & React.RefAttributes<HTMLDivElement>) => {
  return (
    <main
      ref={ref}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col bg-background",
        "md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow",
        className,
      )}
      {...props}
    />
  );
};
SidebarInset.displayName = "SidebarInset";

const SidebarInput = ({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof Input> &
  React.RefAttributes<React.ElementRef<typeof Input>>) => {
  return (
    <Input
      ref={ref}
      data-sidebar="input"
      className={cn(
        "h-8 w-full bg-background shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        className,
      )}
      {...props}
    />
  );
};
SidebarInput.displayName = "SidebarInput";

const SidebarHeader = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"div"> & React.RefAttributes<HTMLDivElement>) => {
  return (
    <div
      ref={ref}
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  );
};
SidebarHeader.displayName = "SidebarHeader";

const SidebarFooter = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"div"> & React.RefAttributes<HTMLDivElement>) => {
  return (
    <div
      ref={ref}
      data-sidebar="footer"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  );
};
SidebarFooter.displayName = "SidebarFooter";

const SidebarSeparator = ({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof Separator> &
  React.RefAttributes<React.ElementRef<typeof Separator>>) => {
  return (
    <Separator
      ref={ref}
      data-sidebar="separator"
      className={cn("mx-2 w-auto bg-sidebar-border", className)}
      {...props}
    />
  );
};
SidebarSeparator.displayName = "SidebarSeparator";

const SidebarContent = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"div"> & React.RefAttributes<HTMLDivElement>) => {
  return (
    <div
      ref={ref}
      data-sidebar="content"
      className={cn(
        "relative flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className,
      )}
      {...props}
    />
  );
};
SidebarContent.displayName = "SidebarContent";

const ACTIVE_ITEM_SELECTOR =
  "[data-sidebar=menu-button][data-active=true], [data-sidebar=menu-sub-button][data-active=true]";

type Box = { x: number; y: number; width: number; height: number };

/**
 * Whether the reader sees all of an active item: it is displayed, its group
 * is not closing, and an opening group has grown past it.
 */
function isFullyShown(item: HTMLElement, container: HTMLElement) {
  const rect = item.getBoundingClientRect();
  if (rect.height === 0) return false;
  for (
    let element = item.parentElement;
    element && element !== container;
    element = element.parentElement
  ) {
    if (element.dataset.slot !== "collapsible-content") continue;
    if (element.dataset.state === "closed") return false;
    if (element.getBoundingClientRect().bottom < rect.bottom - 0.5) {
      return false;
    }
  }
  return true;
}

type ActiveItem = { element: HTMLElement; box: Box };

function findActiveItem(container: HTMLElement): ActiveItem | null {
  const items = container.querySelectorAll<HTMLElement>(ACTIVE_ITEM_SELECTOR);
  // A parent and its page are both active; the page, later in the DOM, wins.
  const element = [...items]
    .reverse()
    .find((candidate) => isFullyShown(candidate, container));
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  const origin = container.getBoundingClientRect();
  return {
    element,
    box: {
      x: rect.left - origin.left - container.clientLeft + container.scrollLeft,
      y: rect.top - origin.top - container.clientTop + container.scrollTop,
      width: rect.width,
      height: rect.height,
    },
  };
}

const INDICATOR_SPRING = {
  stiffness: SPRING.stiffness,
  damping: SPRING.damping,
  mass: SPRING.mass,
};

/**
 * One background behind the active menu item that springs to the next active
 * item. Render it first inside `SidebarContent`: it sits in the scroll
 * content, outside the buttons and groups that clip, and follows the item
 * through route changes, group toggles, collapse and resize.
 */
const SidebarActiveIndicator = ({ className }: { className?: string }) => {
  const ref = React.useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();

  React.useLayoutEffect(() => {
    const indicator = ref.current;
    const container = indicator?.parentElement;
    if (!indicator || !container) return;
    const values = {
      x: springValue<number>(0, INDICATOR_SPRING),
      y: springValue<number>(0, INDICATOR_SPRING),
      width: springValue<number>(0, INDICATOR_SPRING),
      height: springValue<number>(0, INDICATOR_SPRING),
    };
    const keys = Object.keys(values) as (keyof Box)[];
    // Written straight to the element, so a jump paints in the frame that
    // measured it rather than one frame behind the item.
    const render = () => {
      indicator.style.transform = `translate(${values.x.get()}px, ${values.y.get()}px)`;
      indicator.style.width = `${values.width.get()}px`;
      indicator.style.height = `${values.height.get()}px`;
    };
    const unsubscribe = keys.map((key) => values[key].on("change", render));
    let current: ActiveItem | null = null;

    const measure = () => {
      const next = findActiveItem(container);
      if (next) {
        const previous = current;
        // Glide to a newly active item. Layout shifts move the same item, and
        // the indicator follows those exactly unless a glide is still going.
        const glide =
          previous !== null &&
          !reduceMotion &&
          (next.element !== previous.element ||
            keys.some(
              (key) => Math.abs(values[key].get() - previous.box[key]) > 0.5,
            ));
        for (const key of keys) {
          if (glide) values[key].set(next.box[key]);
          else values[key].jump(next.box[key]);
        }
      }
      current = next;
      indicator.style.visibility = next ? "visible" : "hidden";
      container.toggleAttribute("data-active-indicator", next !== null);
    };

    // Resize callbacks run after layout and before paint, so measuring in
    // them keeps up with a group's height animation frame by frame.
    const resizeObserver = new ResizeObserver(measure);
    const observeItems = () => {
      resizeObserver.disconnect();
      resizeObserver.observe(container);
      for (const item of container.querySelectorAll(
        "[data-sidebar=menu-item]",
      )) {
        resizeObserver.observe(item);
      }
    };
    const mutationObserver = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === "childList")) {
        observeItems();
      }
      measure();
    });
    mutationObserver.observe(container, {
      subtree: true,
      childList: true,
      attributeFilter: ["data-active", "data-state"],
    });
    observeItems();
    measure();

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      for (const stop of unsubscribe) stop();
      for (const key of keys) values[key].destroy();
      container.removeAttribute("data-active-indicator");
    };
  }, [reduceMotion]);

  return (
    <span
      ref={ref}
      aria-hidden
      data-sidebar="active-indicator"
      className={cn(
        "pointer-events-none invisible absolute left-0 top-0 rounded-md bg-sidebar-accent",
        className,
      )}
    />
  );
};
SidebarActiveIndicator.displayName = "SidebarActiveIndicator";

const SidebarGroup = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"div"> & React.RefAttributes<HTMLDivElement>) => {
  return (
    <div
      ref={ref}
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  );
};
SidebarGroup.displayName = "SidebarGroup";

const SidebarGroupLabel = ({
  className,
  asChild = false,
  ref,
  ...props
}: React.ComponentProps<"div"> & {
  asChild?: boolean;
} & React.RefAttributes<HTMLDivElement>) => {
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      ref={ref}
      data-sidebar="group-label"
      className={cn(
        "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className,
      )}
      {...props}
    />
  );
};
SidebarGroupLabel.displayName = "SidebarGroupLabel";

const SidebarGroupAction = ({
  className,
  asChild = false,
  ref,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean;
} & React.RefAttributes<HTMLButtonElement>) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      data-sidebar="group-action"
      className={cn(
        "absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
};
SidebarGroupAction.displayName = "SidebarGroupAction";

const SidebarGroupContent = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"div"> & React.RefAttributes<HTMLDivElement>) => (
  <div
    ref={ref}
    data-sidebar="group-content"
    className={cn("w-full text-sm", className)}
    {...props}
  />
);
SidebarGroupContent.displayName = "SidebarGroupContent";

const SidebarMenu = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"ul"> & React.RefAttributes<HTMLUListElement>) => (
  <ul
    ref={ref}
    data-sidebar="menu"
    className={cn("flex w-full min-w-0 flex-col gap-1", className)}
    {...props}
  />
);
SidebarMenu.displayName = "SidebarMenu";

const SidebarMenuItem = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"li"> & React.RefAttributes<HTMLLIElement>) => (
  <li
    ref={ref}
    data-sidebar="menu-item"
    className={cn("group/menu-item relative", className)}
    {...props}
  />
);
SidebarMenuItem.displayName = "SidebarMenuItem";

/**
 * The active item's own background, shown only until a
 * `SidebarActiveIndicator` in the same content has taken over.
 */
const ACTIVE_BACKGROUND_FALLBACK =
  "[&:not([data-active-indicator]_*)]:data-[active=true]:bg-sidebar-accent";

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:!p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const SidebarMenuButton = ({
  asChild = false,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ref,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string | React.ComponentProps<typeof TooltipContent>;
} & VariantProps<typeof sidebarMenuButtonVariants> &
  React.RefAttributes<HTMLButtonElement>) => {
  const Comp = asChild ? Slot : "button";
  const { isMobile, state } = useSidebar();

  const button = (
    <Comp
      ref={ref}
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        sidebarMenuButtonVariants({ variant, size }),
        ACTIVE_BACKGROUND_FALLBACK,
        className,
      )}
      {...props}
    />
  );

  if (!tooltip) {
    return button;
  }

  if (typeof tooltip === "string") {
    tooltip = {
      children: tooltip,
    };
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
        {...tooltip}
      />
    </Tooltip>
  );
};
SidebarMenuButton.displayName = "SidebarMenuButton";

const SidebarMenuAction = ({
  className,
  asChild = false,
  showOnHover = false,
  ref,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean;
  showOnHover?: boolean;
} & React.RefAttributes<HTMLButtonElement>) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-action"
      className={cn(
        "absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0",
        className,
      )}
      {...props}
    />
  );
};
SidebarMenuAction.displayName = "SidebarMenuAction";

const SidebarMenuBadge = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"div"> & React.RefAttributes<HTMLDivElement>) => (
  <div
    ref={ref}
    data-sidebar="menu-badge"
    className={cn(
      "pointer-events-none absolute right-1 flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-sidebar-foreground",
      "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
      "peer-data-[size=sm]/menu-button:top-1",
      "peer-data-[size=default]/menu-button:top-1.5",
      "peer-data-[size=lg]/menu-button:top-2.5",
      "group-data-[collapsible=icon]:hidden",
      className,
    )}
    {...props}
  />
);
SidebarMenuBadge.displayName = "SidebarMenuBadge";

const SidebarMenuSkeleton = ({
  className,
  showIcon = false,
  ref,
  ...props
}: React.ComponentProps<"div"> & {
  showIcon?: boolean;
} & React.RefAttributes<HTMLDivElement>) => {
  const width = `${Math.floor(Math.random() * 40) + 50}%`;

  return (
    <div
      ref={ref}
      data-sidebar="menu-skeleton"
      className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-4 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-4 max-w-[--skeleton-width] flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  );
};
SidebarMenuSkeleton.displayName = "SidebarMenuSkeleton";

const SidebarMenuSub = ({
  className,
  ref,
  ...props
}: React.ComponentProps<"ul"> & React.RefAttributes<HTMLUListElement>) => (
  <ul
    ref={ref}
    data-sidebar="menu-sub"
    className={cn(
      "mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5",
      "group-data-[collapsible=icon]:hidden",
      className,
    )}
    {...props}
  />
);
SidebarMenuSub.displayName = "SidebarMenuSub";

const SidebarMenuSubItem = ({
  ref,
  ...props
}: React.ComponentProps<"li"> & React.RefAttributes<HTMLLIElement>) => (
  <li ref={ref} {...props} />
);
SidebarMenuSubItem.displayName = "SidebarMenuSubItem";

const SidebarMenuSubButton = ({
  asChild = false,
  size = "md",
  isActive,
  className,
  ref,
  ...props
}: React.ComponentProps<"a"> & {
  asChild?: boolean;
  size?: "sm" | "md";
  isActive?: boolean;
} & React.RefAttributes<HTMLAnchorElement>) => {
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground outline-none ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
        "data-[active=true]:text-sidebar-accent-foreground",
        ACTIVE_BACKGROUND_FALLBACK,
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
};
SidebarMenuSubButton.displayName = "SidebarMenuSubButton";

export {
  Sidebar,
  SidebarActiveIndicator,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
