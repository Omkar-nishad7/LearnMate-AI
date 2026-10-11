"use client";

import { useEffect, useState } from "react";

export function useSidebar(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setOpen(true);
    };

    onResize();
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  return {
    open,
    setOpen,
    openSidebar: () => setOpen(true),
    closeSidebar: () => setOpen(false),
    toggleSidebar: () => setOpen((prev) => !prev)
  };
}