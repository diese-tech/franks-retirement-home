import PixelBadge from './PixelBadge';

const STATUS_COLOR_MAP = {
  pending:  'yellow',
  lobby:    'blue',
  banning:  'orange',
  picking:  'lime',
  active:   'lime',
  complete: 'gray',
};

export default function StatusBadge({ status }) {
  const color = STATUS_COLOR_MAP[status] ?? 'gray';
  return <PixelBadge label={status.toUpperCase()} color={color} />;
}
