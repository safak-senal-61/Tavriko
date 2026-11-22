// The native apps already manage their own system bars.
export function DesktopFullscreenBar(_props: {
  enabled: boolean;
  targetId: string;
  onFullscreenChange: (active: boolean) => void;
}) {
  return null;
}
