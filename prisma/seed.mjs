import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Smite 2 Draft League...\n');

  // ── Gods ──────────────────────────────────────────
  const gods = [
    { name: 'Achilles',     role: 'Warrior',  godClass: 'Physical' },
    { name: 'Agni',         role: 'Mage',     godClass: 'Magical' },
    { name: 'Ah Muzen Cab', role: 'Hunter',   godClass: 'Physical' },
    { name: 'Amaterasu',    role: 'Warrior',  godClass: 'Physical' },
    { name: 'Anhur',        role: 'Hunter',   godClass: 'Physical' },
    { name: 'Anubis',       role: 'Mage',     godClass: 'Magical' },
    { name: 'Ao Kuang',     role: 'Mage',     godClass: 'Magical' },
    { name: 'Apollo',       role: 'Hunter',   godClass: 'Physical' },
    { name: 'Ares',         role: 'Guardian', godClass: 'Magical' },
    { name: 'Artemis',      role: 'Hunter',   godClass: 'Physical' },
    { name: 'Athena',       role: 'Guardian', godClass: 'Magical' },
    { name: 'Bacchus',      role: 'Guardian', godClass: 'Magical' },
    { name: 'Bakasura',     role: 'Assassin', godClass: 'Physical' },
    { name: 'Baron Samedi', role: 'Mage',     godClass: 'Magical' },
    { name: 'Bellona',      role: 'Warrior',  godClass: 'Physical' },
    { name: 'Cabrakan',     role: 'Guardian', godClass: 'Magical' },
    { name: 'Cerberus',     role: 'Guardian', godClass: 'Magical' },
    { name: 'Chaac',        role: 'Warrior',  godClass: 'Physical' },
    { name: 'Cthulhu',      role: 'Guardian', godClass: 'Magical' },
    { name: 'Cu Chulainn',  role: 'Warrior',  godClass: 'Physical' },
    { name: 'Da Ji',        role: 'Assassin', godClass: 'Physical' },
    { name: 'Discordia',    role: 'Mage',     godClass: 'Magical' },
    { name: 'Fenrir',       role: 'Assassin', godClass: 'Physical' },
    { name: 'Ganesha',      role: 'Guardian', godClass: 'Magical' },
    { name: 'Geb',          role: 'Guardian', godClass: 'Magical' },
    { name: 'Hades',        role: 'Mage',     godClass: 'Magical' },
    { name: 'He Bo',        role: 'Mage',     godClass: 'Magical' },
    { name: 'Hercules',     role: 'Warrior',  godClass: 'Physical' },
    { name: 'Hou Yi',       role: 'Hunter',   godClass: 'Physical' },
    { name: 'Hun Batz',     role: 'Assassin', godClass: 'Physical' },
    { name: 'Janus',        role: 'Mage',     godClass: 'Magical' },
    { name: 'Jing Wei',     role: 'Hunter',   godClass: 'Physical' },
    { name: 'Khepri',       role: 'Guardian', godClass: 'Magical' },
    { name: 'Kukulkan',     role: 'Mage',     godClass: 'Magical' },
    { name: 'Loki',         role: 'Assassin', godClass: 'Physical' },
    { name: 'Medusa',       role: 'Hunter',   godClass: 'Physical' },
    { name: 'Mercury',      role: 'Assassin', godClass: 'Physical' },
    { name: 'Ne Zha',       role: 'Assassin', godClass: 'Physical' },
    { name: 'Neith',        role: 'Hunter',   godClass: 'Physical' },
    { name: 'Nemesis',      role: 'Assassin', godClass: 'Physical' },
    { name: 'Nike',         role: 'Warrior',  godClass: 'Physical' },
    { name: 'Nox',          role: 'Mage',     godClass: 'Magical' },
    { name: 'Nu Wa',        role: 'Mage',     godClass: 'Magical' },
    { name: 'Odin',         role: 'Warrior',  godClass: 'Physical' },
    { name: 'Osiris',       role: 'Warrior',  godClass: 'Physical' },
    { name: 'Poseidon',     role: 'Mage',     godClass: 'Magical' },
    { name: 'Ra',           role: 'Mage',     godClass: 'Magical' },
    { name: 'Rama',         role: 'Hunter',   godClass: 'Physical' },
    { name: 'Scylla',       role: 'Mage',     godClass: 'Magical' },
    { name: 'Sobek',        role: 'Guardian', godClass: 'Magical' },
    { name: 'Sol',          role: 'Mage',     godClass: 'Magical' },
    { name: 'Sun Wukong',   role: 'Warrior',  godClass: 'Physical' },
    { name: 'Susano',       role: 'Assassin', godClass: 'Physical' },
    { name: 'Sylvanus',     role: 'Guardian', godClass: 'Magical' },
    { name: 'Thanatos',     role: 'Assassin', godClass: 'Physical' },
    { name: 'The Morrigan', role: 'Mage',     godClass: 'Magical' },
    { name: 'Thor',         role: 'Assassin', godClass: 'Physical' },
    { name: 'Tyr',          role: 'Warrior',  godClass: 'Physical' },
    { name: 'Ullr',         role: 'Hunter',   godClass: 'Physical' },
    { name: 'Vulcan',       role: 'Mage',     godClass: 'Magical' },
    { name: 'Xbalanque',    role: 'Hunter',   godClass: 'Physical' },
    { name: 'Yemoja',       role: 'Guardian', godClass: 'Magical' },
    { name: 'Ymir',         role: 'Guardian', godClass: 'Magical' },
    { name: 'Zeus',         role: 'Mage',     godClass: 'Magical' },
    { name: 'Zhong Kui',    role: 'Mage',     godClass: 'Magical' },
  ];

  for (const god of gods) {
    await prisma.god.upsert({
      where: { id: god.name.toLowerCase().replace(/\s+/g, '-') },
      update: god,
      create: { id: god.name.toLowerCase().replace(/\s+/g, '-'), ...god },
    });
  }
  console.log(`  ✓ ${gods.length} gods seeded`);

  // ── Players ───────────────────────────────────────
  const players = [
    { name: 'Zapman',       role: 'Carry',   pointValue: 5 },
    { name: 'Pandacat',     role: 'Carry',   pointValue: 5 },
    { name: 'Paul',         role: 'Mid',     pointValue: 4 },
    { name: 'Sheento',      role: 'Mid',     pointValue: 5 },
    { name: 'Fineokay',     role: 'Solo',    pointValue: 4 },
    { name: 'Haddix',       role: 'Solo',    pointValue: 3 },
    { name: 'Inbowned',     role: 'Support', pointValue: 4 },
    { name: 'Ronngyu',      role: 'Support', pointValue: 5 },
    { name: 'Adapting',     role: 'Jungle',  pointValue: 5 },
    { name: 'Sam4soccer2',  role: 'Jungle',  pointValue: 4 },
    { name: 'Venenu',       role: 'Mid',     pointValue: 3 },
    { name: 'Netrioid',     role: 'Carry',   pointValue: 3 },
    { name: 'Genetics',     role: 'Jungle',  pointValue: 3 },
    { name: 'NeilMah',      role: 'Support', pointValue: 3 },
    { name: 'SoloOrTroll',  role: 'Solo',    pointValue: 2 },
    { name: 'Boronic',      role: 'Mid',     pointValue: 2 },
    { name: 'Layers',       role: 'Jungle',  pointValue: 2 },
    { name: 'AwesomeJake',  role: 'Support', pointValue: 2 },
    { name: 'Jarcorr',      role: 'Solo',    pointValue: 4 },
    { name: 'CycloneSpin',  role: 'Solo',    pointValue: 3 },
  ];

  for (const player of players) {
    await prisma.player.upsert({
      where: { id: player.name.toLowerCase().replace(/\s+/g, '-') },
      update: player,
      create: { id: player.name.toLowerCase().replace(/\s+/g, '-'), ...player },
    });
  }
  console.log(`  ✓ ${players.length} players seeded`);

  // ── Sample Draft ──────────────────────────────────
  await prisma.draft.upsert({
    where: { id: 'sample-draft-1' },
    update: {},
    create: {
      id: 'sample-draft-1',
      name: 'Season 1 — Draft Night',
      status: 'pending',
    },
  });
  console.log('  ✓ 1 sample draft created');

  console.log('\n✅ Seed complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
