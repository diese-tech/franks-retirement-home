import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Smite 2 Draft League...\n');

  // ── Gods ──────────────────────────────────────────
  const gods = [
    // Warriors
    { name: 'Achilles',     role: 'Warrior',  godClass: 'Physical' },
    { name: 'Amaterasu',    role: 'Warrior',  godClass: 'Physical' },
    { name: 'Bellona',      role: 'Warrior',  godClass: 'Physical' },
    { name: 'Chaac',        role: 'Warrior',  godClass: 'Physical' },
    { name: 'Gilgamesh',    role: 'Warrior',  godClass: 'Physical' },
    { name: 'Guan Yu',      role: 'Warrior',  godClass: 'Physical' },
    { name: 'Hercules',     role: 'Warrior',  godClass: 'Physical' },
    { name: 'Hua Mulan',    role: 'Warrior',  godClass: 'Physical' },
    { name: 'Mordred',      role: 'Warrior',  godClass: 'Physical' },
    { name: 'Odin',         role: 'Warrior',  godClass: 'Physical' },
    { name: 'Osiris',       role: 'Warrior',  godClass: 'Physical' },
    { name: 'Sun Wukong',   role: 'Warrior',  godClass: 'Physical' },
    // Assassins
    { name: 'Aladdin',      role: 'Assassin', godClass: 'Physical' },
    { name: 'Awilix',       role: 'Assassin', godClass: 'Physical' },
    { name: 'Da Ji',        role: 'Assassin', godClass: 'Physical' },
    { name: 'Fenrir',       role: 'Assassin', godClass: 'Physical' },
    { name: 'Hun Batz',     role: 'Assassin', godClass: 'Physical' },
    { name: 'Kali',         role: 'Assassin', godClass: 'Physical' },
    { name: 'Loki',         role: 'Assassin', godClass: 'Physical' },
    { name: 'Mercury',      role: 'Assassin', godClass: 'Physical' },
    { name: 'Ne Zha',       role: 'Assassin', godClass: 'Physical' },
    { name: 'Nemesis',      role: 'Assassin', godClass: 'Physical' },
    { name: 'Pele',         role: 'Assassin', godClass: 'Physical' },
    { name: 'Ratatoskr',    role: 'Assassin', godClass: 'Physical' },
    { name: 'Susano',       role: 'Assassin', godClass: 'Physical' },
    { name: 'Thanatos',     role: 'Assassin', godClass: 'Physical' },
    { name: 'Thor',         role: 'Assassin', godClass: 'Physical' },
    { name: 'Tsukuyomi',    role: 'Assassin', godClass: 'Physical' },
    // Mages
    { name: 'Ah Puch',      role: 'Mage',     godClass: 'Magical' },
    { name: 'Agni',         role: 'Mage',     godClass: 'Magical' },
    { name: 'Anubis',       role: 'Mage',     godClass: 'Magical' },
    { name: 'Aphrodite',    role: 'Mage',     godClass: 'Magical' },
    { name: 'Baron Samedi', role: 'Mage',     godClass: 'Magical' },
    { name: 'Discordia',    role: 'Mage',     godClass: 'Magical' },
    { name: 'Eset',         role: 'Mage',     godClass: 'Magical' },
    { name: 'Hades',        role: 'Mage',     godClass: 'Magical' },
    { name: 'Hecate',       role: 'Mage',     godClass: 'Magical' },
    { name: 'Janus',        role: 'Mage',     godClass: 'Magical' },
    { name: 'Kukulkan',     role: 'Mage',     godClass: 'Magical' },
    { name: 'Merlin',       role: 'Mage',     godClass: 'Magical' },
    { name: 'Morgan Le Fay',role: 'Mage',     godClass: 'Magical' },
    { name: 'Nu Wa',        role: 'Mage',     godClass: 'Magical' },
    { name: 'Nut',          role: 'Mage',     godClass: 'Magical' },
    { name: 'Poseidon',     role: 'Mage',     godClass: 'Magical' },
    { name: 'Ra',           role: 'Mage',     godClass: 'Magical' },
    { name: 'Scylla',       role: 'Mage',     godClass: 'Magical' },
    { name: 'Sol',          role: 'Mage',     godClass: 'Magical' },
    { name: 'The Morrigan', role: 'Mage',     godClass: 'Magical' },
    { name: 'Vulcan',       role: 'Mage',     godClass: 'Magical' },
    { name: 'Zeus',         role: 'Mage',     godClass: 'Magical' },
    // Guardians
    { name: 'Ares',         role: 'Guardian', godClass: 'Magical' },
    { name: 'Artio',        role: 'Guardian', godClass: 'Magical' },
    { name: 'Athena',       role: 'Guardian', godClass: 'Magical' },
    { name: 'Bacchus',      role: 'Guardian', godClass: 'Magical' },
    { name: 'Cabrakan',     role: 'Guardian', godClass: 'Magical' },
    { name: 'Cerberus',     role: 'Guardian', godClass: 'Magical' },
    { name: 'Charon',       role: 'Guardian', godClass: 'Magical' },
    { name: 'Ganesha',      role: 'Guardian', godClass: 'Magical' },
    { name: 'Geb',          role: 'Guardian', godClass: 'Magical' },
    { name: 'Jormungandr',  role: 'Guardian', godClass: 'Magical' },
    { name: 'Khepri',       role: 'Guardian', godClass: 'Magical' },
    { name: 'Sobek',        role: 'Guardian', godClass: 'Magical' },
    { name: 'Sylvanus',     role: 'Guardian', godClass: 'Magical' },
    { name: 'Atlas',        role: 'Guardian', godClass: 'Magical' },
    { name: 'Yemoja',       role: 'Guardian', godClass: 'Magical' },
    { name: 'Ymir',         role: 'Guardian', godClass: 'Magical' },
    // Hunters
    { name: 'Anhur',        role: 'Hunter',   godClass: 'Physical' },
    { name: 'Apollo',       role: 'Hunter',   godClass: 'Physical' },
    { name: 'Artemis',      role: 'Hunter',   godClass: 'Physical' },
    { name: 'Cernunnos',    role: 'Hunter',   godClass: 'Physical' },
    { name: 'Chiron',       role: 'Hunter',   godClass: 'Physical' },
    { name: 'Cupid',        role: 'Hunter',   godClass: 'Physical' },
    { name: 'Danzaburou',   role: 'Hunter',   godClass: 'Physical' },
    { name: 'Hou Yi',       role: 'Hunter',   godClass: 'Physical' },
    { name: 'Ishtar',       role: 'Hunter',   godClass: 'Physical' },
    { name: 'Izanami',      role: 'Hunter',   godClass: 'Physical' },
    { name: 'Jing Wei',     role: 'Hunter',   godClass: 'Physical' },
    { name: 'Medusa',       role: 'Hunter',   godClass: 'Physical' },
    { name: 'Neith',        role: 'Hunter',   godClass: 'Physical' },
    { name: 'Princess Bari',role: 'Hunter',   godClass: 'Physical' },
    { name: 'Rama',         role: 'Hunter',   godClass: 'Physical' },
    { name: 'Ullr',         role: 'Hunter',   godClass: 'Physical' },
    { name: 'Xbalanque',    role: 'Hunter',   godClass: 'Physical' },
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
    { name: 'Zapman',       role: 'Carry'   },
    { name: 'Pandacat',     role: 'Carry'   },
    { name: 'Paul',         role: 'Mid'     },
    { name: 'Sheento',      role: 'Mid'     },
    { name: 'Fineokay',     role: 'Solo'    },
    { name: 'Haddix',       role: 'Solo'    },
    { name: 'Inbowned',     role: 'Support' },
    { name: 'Ronngyu',      role: 'Support' },
    { name: 'Adapting',     role: 'Jungle'  },
    { name: 'Sam4soccer2',  role: 'Jungle'  },
    { name: 'Venenu',       role: 'Mid'     },
    { name: 'Netrioid',     role: 'Carry'   },
    { name: 'Genetics',     role: 'Jungle'  },
    { name: 'NeilMah',      role: 'Support' },
    { name: 'SoloOrTroll',  role: 'Solo'    },
    { name: 'Boronic',      role: 'Mid'     },
    { name: 'Layers',       role: 'Jungle'  },
    { name: 'AwesomeJake',  role: 'Support' },
    { name: 'Jarcorr',      role: 'Solo'    },
    { name: 'CycloneSpin',  role: 'Solo'    },
  ];

  for (const player of players) {
    await prisma.player.upsert({
      where: { id: player.name.toLowerCase().replace(/\s+/g, '-') },
      update: player,
      create: { id: player.name.toLowerCase().replace(/\s+/g, '-'), ...player },
    });
  }
  console.log(`  ✓ ${players.length} players seeded`);

  // ── Season 9 ──────────────────────────────────────
  const season9 = await prisma.season.upsert({
    where: { slug: 's9' },
    update: { name: 'Season 9', status: 'upcoming' },
    create: { id: 'season-9', slug: 's9', name: 'Season 9', status: 'upcoming' },
  });

  await prisma.division.upsert({
    where: { id: 'div-s9-hospice' },
    update: { name: 'Hospice', tier: 1 },
    create: { id: 'div-s9-hospice', seasonId: season9.id, name: 'Hospice', tier: 1 },
  });

  await prisma.division.upsert({
    where: { id: 'div-s9-rehabilitation' },
    update: { name: 'Rehabilitation', tier: 2 },
    create: { id: 'div-s9-rehabilitation', seasonId: season9.id, name: 'Rehabilitation', tier: 2 },
  });

  console.log('  ✓ Season 9 seeded (Hospice + Rehabilitation divisions)');

  // ── Teams ─────────────────────────────────────────
  const teams = [
    // Hospice division
    { id: 'team-galactic-stingers', name: 'The Galactic Stingers', tag: 'GLXS', divisionId: 'div-s9-hospice' },
    { id: 'team-caustic-crusaders', name: 'Caustic Crusaders', tag: 'CSTC', divisionId: 'div-s9-hospice' },
    { id: 'team-death-dealers', name: 'Death Dealers', tag: 'DEAD', divisionId: 'div-s9-hospice' },
    { id: 'team-wheezys-mafia', name: "Wheezy's Mafia", tag: 'WHZY', divisionId: 'div-s9-hospice' },
    // Rehabilitation division
    { id: 'team-ruined-order', name: 'The Ruined Order', tag: 'RUIN', divisionId: 'div-s9-rehabilitation' },
    { id: 'team-kappa-corp', name: 'Kappa Corp', tag: 'KAPA', divisionId: 'div-s9-rehabilitation' },
    { id: 'team-exile-extinction', name: 'Exile Extinction', tag: 'EXIL', divisionId: 'div-s9-rehabilitation' },
    { id: 'team-valhalla-vikings', name: 'Valhalla Vikings', tag: 'VALK', divisionId: 'div-s9-rehabilitation' },
    { id: 'team-babas-kitchen', name: "Baba's Kitchen", tag: 'BABA', divisionId: 'div-s9-rehabilitation' },
    { id: 'team-cyberpunk-otters', name: 'Cyberpunk Otters', tag: 'CYBR', divisionId: 'div-s9-rehabilitation' },
  ];

  for (const team of teams) {
    await prisma.team.upsert({
      where: { id: team.id },
      update: { name: team.name, tag: team.tag },
      create: team,
    });
  }
  console.log(`  ✓ ${teams.length} teams seeded`);

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
