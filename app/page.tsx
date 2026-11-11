import LandingSwitch from "@/components/LandingSwitch";

// LandingSwitch показывает прежний Landing, а новый макет (LandingV2) только по флагу (lib/layout-flag.ts)
export default function Home() {
  return <LandingSwitch />;
}
