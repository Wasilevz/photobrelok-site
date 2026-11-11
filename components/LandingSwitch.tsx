"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import Landing from "@/components/Landing";
import { readLayoutV2 } from "@/lib/layout-flag";

// Новый макет подгружается отдельным куском: пока флаг выключен, он не попадает к посетителям
const LandingV2 = dynamic(() => import("@/components/LandingV2"));

const subscribe = () => () => {};
// На сервере и при первом показе берём значение из сборки; в браузере читаем ?layout=… и память вкладки
const serverSnapshot = () => process.env.NEXT_PUBLIC_LAYOUT === "v2";

export default function LandingSwitch() {
  const v2 = useSyncExternalStore(subscribe, readLayoutV2, serverSnapshot);
  return v2 ? <LandingV2 /> : <Landing />;
}
