import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="frh-footer">
      <div>
        <span className="frh-footer__badge">FRH</span>
        {' '}Frank&apos;s Retirement Home · Low skill. High commitment.
      </div>
      <div style={{ display: 'flex', gap: 14, opacity: 0.9, flexWrap: 'wrap' }}>
        <Link href="/bulletin-board">Bulletin</Link>
        <Link href="/fraud-watch">Fraud Watch</Link>
        <Link href="/knows-ball">Knows Ball</Link>
        <a href="https://discord.gg/HPAZmHmBpD" target="_blank" rel="noreferrer">Discord</a>
      </div>
      <div style={{ opacity: 0.6 }}>build 9.04 · ©FRH Broadcast Wire</div>
    </footer>
  );
}
