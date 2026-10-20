"use client";

import { useEffect, useRef } from "react";
import { initSejongApp } from "../src/app-runner.ts";

export default function SejongApp() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    initSejongApp();
  }, []);

  return null;
}
