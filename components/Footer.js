export default function Footer() {
  return (
    <footer className="frh-footer">
      <div>
        <span className="frh-footer__badge">FRH</span>
        {' '}Frank&apos;s Retirement Home · est. Season 6 · Low skill. High commitment.
      </div>
      <div style={{ display: 'flex', gap: 14, opacity: 0.9, flexWrap: 'wrap' }}>
        <span>Bulletin</span>
        <span>Fraud Watch</span>
        <span>Knows Ball</span>
        <span>Washed Reports</span>
        <a href="https://discord.gg/HPAZmHmBpD" target="_blank" rel="noreferrer">Discord</a>
      </div>
      <div style={{ opacity: 0.6 }}>build 9.04 · ©FRH Broadcast Wire</div>
    </footer>
  );
}
