// Shared helpers for bulletin posts, editorial cases, and betting lines.

import prisma from '@/lib/db';

/** Allowed bulletin post types. */
export const BULLETIN_TYPES = [
  'announcement',
  'match_hype',
  'player_spotlight',
  'team_roast',
  'weekly_recap',
];

/** Types a non-admin player may submit (lands as draft for review). */
export const PLAYER_SUBMITTABLE_TYPES = ['match_hype', 'player_spotlight', 'team_roast'];

/** Allowed editorial case types. */
export const EDITORIAL_TYPES = ['fraud_watch', 'washed_report'];

/** Beer-league themed reaction palette. Keys are stored; labels are for display. */
export const REACTION_EMOJI = ['beer', 'fire', 'skull', 'goat', 'clown'];

/**
 * Turns a title into a URL-safe slug fragment.
 * @param {string} title
 * @returns {string}
 */
export function slugify(title) {
  const base = String(title || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return base || 'post';
}

/**
 * Creates a BulletinPost with a unique slug, retrying on collision.
 * Slug is generated once at creation and never regenerated afterward.
 * @param {object} data - bulletin post data WITHOUT slug
 * @returns {Promise<object>} the created post
 */
export async function createBulletinPostWithUniqueSlug(data) {
  const baseSlug = slugify(data.title);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    try {
      return await prisma.bulletinPost.create({ data: { ...data, slug } });
    } catch (err) {
      // P2002 = unique constraint violation on slug; retry with a suffix
      if (err?.code === 'P2002') continue;
      throw err;
    }
  }
  // Final fallback: append a short random suffix
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
  return prisma.bulletinPost.create({ data: { ...data, slug } });
}
