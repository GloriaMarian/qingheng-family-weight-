import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "轻衡｜家庭体重日记",
    short_name: "轻衡",
    description: "记录体重、餐食和生活状态，关注长期健康趋势。",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5ee",
    theme_color: "#eef6ef",
    orientation: "portrait-primary",
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
