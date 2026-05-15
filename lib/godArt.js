export function toGodImageSlug(god) {
  const raw = god?.imageSlug || god?.id || god?.name || '';

  return String(raw)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

export function getGodIconUrl(god) {
  return `https://www.smitefire.com/images/v2/god/icon/${toGodImageSlug(god)}.png`;
}

export function getGodWideArtUrl(god) {
  return `https://www.smitefire.com/images/v2/god-wide-bgs/${toGodImageSlug(god)}.jpg`;
}
