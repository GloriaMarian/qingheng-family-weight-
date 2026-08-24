import type { Metadata } from "next";
import { getLocalUser } from "./auth";
import WeightApp from "./WeightApp";

export const metadata: Metadata = {
  title: "轻衡｜全家都能用的体重日记",
  description:
    "记录早晚体重、每餐热量与生活状态，用温和清晰的趋势陪伴全家健康生活。",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getLocalUser();
  return (
    <WeightApp
      user={
        user
          ? {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
            }
          : null
      }
    />
  );
}
