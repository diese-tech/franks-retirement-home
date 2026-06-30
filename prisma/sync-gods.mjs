import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const gods = [
  {
    "id": "achilles",
    "name": "Achilles",
    "role": "Warrior",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "agni",
    "name": "Agni",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "ah-puch",
    "name": "Ah Puch",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "aladdin",
    "name": "Aladdin",
    "role": "Assassin",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "amaterasu",
    "name": "Amaterasu",
    "role": "Warrior",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "anhur",
    "name": "Anhur",
    "role": "Hunter",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "anubis",
    "name": "Anubis",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "aphrodite",
    "name": "Aphrodite",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "apollo",
    "name": "Apollo",
    "role": "Hunter",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "ares",
    "name": "Ares",
    "role": "Guardian",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "artemis",
    "name": "Artemis",
    "role": "Hunter",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "artio",
    "name": "Artio",
    "role": "Guardian",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "athena",
    "name": "Athena",
    "role": "Guardian",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "atlas",
    "name": "Atlas",
    "role": "Guardian",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "awilix",
    "name": "Awilix",
    "role": "Assassin",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "bacchus",
    "name": "Bacchus",
    "role": "Guardian",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "baron-samedi",
    "name": "Baron Samedi",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "bastet",
    "name": "Bastet",
    "role": "Assassin",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "bellona",
    "name": "Bellona",
    "role": "Warrior",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "cabrakan",
    "name": "Cabrakan",
    "role": "Guardian",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "cerberus",
    "name": "Cerberus",
    "role": "Guardian",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "cernunnos",
    "name": "Cernunnos",
    "role": "Hunter",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "chaac",
    "name": "Chaac",
    "role": "Warrior",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "charon",
    "name": "Charon",
    "role": "Guardian",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "chiron",
    "name": "Chiron",
    "role": "Hunter",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "chronos",
    "name": "Chronos",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": true
  },
  {
    "id": "cupid",
    "name": "Cupid",
    "role": "Hunter",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "da-ji",
    "name": "Da Ji",
    "role": "Assassin",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "danzaburou",
    "name": "Danzaburou",
    "role": "Hunter",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "discordia",
    "name": "Discordia",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "eset",
    "name": "Eset",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "fenrir",
    "name": "Fenrir",
    "role": "Assassin",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "ganesha",
    "name": "Ganesha",
    "role": "Guardian",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "geb",
    "name": "Geb",
    "role": "Guardian",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "gilgamesh",
    "name": "Gilgamesh",
    "role": "Warrior",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "guan-yu",
    "name": "Guan Yu",
    "role": "Warrior",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "hades",
    "name": "Hades",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "hecate",
    "name": "Hecate",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "hercules",
    "name": "Hercules",
    "role": "Warrior",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "horus",
    "name": "Horus",
    "role": "Warrior",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "hou-yi",
    "name": "Hou Yi",
    "role": "Hunter",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "hua-mulan",
    "name": "Hua Mulan",
    "role": "Warrior",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "hun-batz",
    "name": "Hun Batz",
    "role": "Assassin",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "ishtar",
    "name": "Ishtar",
    "role": "Hunter",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "izanami",
    "name": "Izanami",
    "role": "Hunter",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "janus",
    "name": "Janus",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "jing-wei",
    "name": "Jing Wei",
    "role": "Hunter",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "jormungandr",
    "name": "Jormungandr",
    "role": "Guardian",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "kali",
    "name": "Kali",
    "role": "Assassin",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "khepri",
    "name": "Khepri",
    "role": "Guardian",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "kukulkan",
    "name": "Kukulkan",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "loki",
    "name": "Loki",
    "role": "Assassin",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "medusa",
    "name": "Medusa",
    "role": "Hunter",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "mercury",
    "name": "Mercury",
    "role": "Assassin",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "merlin",
    "name": "Merlin",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "mordred",
    "name": "Mordred",
    "role": "Warrior",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "morgan-le-fay",
    "name": "Morgan Le Fay",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "ne-zha",
    "name": "Ne Zha",
    "role": "Assassin",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "neith",
    "name": "Neith",
    "role": "Hunter",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "nemesis",
    "name": "Nemesis",
    "role": "Assassin",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "nu-wa",
    "name": "Nu Wa",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "nut",
    "name": "Nut",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "odin",
    "name": "Odin",
    "role": "Warrior",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "osiris",
    "name": "Osiris",
    "role": "Warrior",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "pele",
    "name": "Pele",
    "role": "Assassin",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "poseidon",
    "name": "Poseidon",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "princess-bari",
    "name": "Princess Bari",
    "role": "Hunter",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "ra",
    "name": "Ra",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "rama",
    "name": "Rama",
    "role": "Hunter",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "ratatoskr",
    "name": "Ratatoskr",
    "role": "Assassin",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "scylla",
    "name": "Scylla",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "sobek",
    "name": "Sobek",
    "role": "Guardian",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "sol",
    "name": "Sol",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "sun-wukong",
    "name": "Sun Wukong",
    "role": "Warrior",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "susano",
    "name": "Susano",
    "role": "Assassin",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "sylvanus",
    "name": "Sylvanus",
    "role": "Guardian",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "thanatos",
    "name": "Thanatos",
    "role": "Assassin",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "the-morrigan",
    "name": "The Morrigan",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "thor",
    "name": "Thor",
    "role": "Assassin",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "tsukuyomi",
    "name": "Tsukuyomi",
    "role": "Assassin",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "ullr",
    "name": "Ullr",
    "role": "Hunter",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "vulcan",
    "name": "Vulcan",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "xbalanque",
    "name": "Xbalanque",
    "role": "Hunter",
    "godClass": "Physical",
    "needsReview": false
  },
  {
    "id": "yemoja",
    "name": "Yemoja",
    "role": "Guardian",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "ymir",
    "name": "Ymir",
    "role": "Guardian",
    "godClass": "Magical",
    "needsReview": false
  },
  {
    "id": "zeus",
    "name": "Zeus",
    "role": "Mage",
    "godClass": "Magical",
    "needsReview": false
  }
];

async function main() {
  const needsReview = gods.filter((god) => god.needsReview).map((god) => god.name);
  if (needsReview.length) {
    console.warn(`Gods using placeholder class metadata; review manually: ${needsReview.join(', ')}`);
  }
  for (const god of gods) {
    const { needsReview, ...data } = god;
    await prisma.god.upsert({
      where: { id: data.id },
      update: { name: data.name, role: data.role, godClass: data.godClass },
      create: data
    });
  }
  console.log(`Synced ${gods.length} gods from smite-content-sync.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
