"use client";

import Spline from "@splinetool/react-spline";

export default function SplineScene() {
  return (
    <div className="h-screen w-screen">

      <Spline
        scene="https://prod.spline.design/FaNvdIUZkQYIQFhM/scene.splinecode"
        style={{
          width: "100%",
          height: "100%",
          filter: "none",
          opacity: 1,
        }}
      />

    </div>
  );
}