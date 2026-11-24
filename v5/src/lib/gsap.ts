"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { useGSAP } from "@gsap/react";

// One registration point; no CDN globals or private registry are required.
gsap.registerPlugin(ScrollTrigger, Flip, DrawSVGPlugin, MotionPathPlugin, useGSAP);
export { gsap, ScrollTrigger, Flip, DrawSVGPlugin, MotionPathPlugin, useGSAP };
