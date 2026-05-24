import RetroWindow from './RetroWindow';

export default function RightRailWidget({ title, children }) {
  return (
    <RetroWindow title={title} titleBarColor="gray">
      {children}
    </RetroWindow>
  );
}
