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

  // ── Season 9 Players (S9 real roster snapshot) ────────────────────────────
  // IDs are the real cuid values from production DB so upserts are idempotent.
  const players = [
    // Hospice
    { id: 'cmpq3tza600083bs4ei78ipjh', name: 'Bendizzle13',                   role: 'Fill',    division: 'Hospice',        discordUsername: 'Bendizzle13',      timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Fill'] },
    { id: 'cmpq3tydd00063bs4eo7ls4a5', name: 'Bleach',                        role: 'Solo',    division: 'Hospice',        discordUsername: 'Bleach',           timezone: 'Central Standard Time (CST)', secondaryRoles: ['Solo','Jungle','Support'] },
    { id: 'cmpq3u3dv000h3bs43wbm7bz3', name: 'Br1tterz',                     role: 'Mid',     division: 'Hospice',        discordUsername: 'Br1tterz',         timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Mid','Carry'] },
    { id: 'cmpq3uw6i000m3bs4cfcb9hhg', name: 'CausticWhite',                  role: 'Support', division: 'Hospice',        discordUsername: 'CausticWhite',     timezone: 'Central Standard Time (CST)', secondaryRoles: ['Solo','Fill'] },
    { id: 'cmpq3tzqk00093bs421mlr8li', name: 'Chefbaba',                      role: 'Mid',     division: 'Hospice',        discordUsername: 'Daddy chef',       timezone: 'Central Standard Time (CST)', secondaryRoles: ['Fill'] },
    { id: 'cmpq3tvmm00003bs4ffgpetfl', name: 'Dary',                          role: 'Support', division: 'Hospice',        discordUsername: 'Dary',             timezone: 'Eastern Standard Time (EST)', secondaryRoles: [] },
    { id: 'cmpq3txgj00043bs4dd9bg7o4', name: 'deathxthexking',                role: 'Jungle',  division: 'Hospice',        discordUsername: 'deathxthexking',   timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Carry'] },
    { id: 'cmpq3twjp00023bs4lui58hw4', name: 'Fiesty',                        role: 'Mid',     division: 'Hospice',        discordUsername: 'FiestyLobster',    timezone: 'Other',                       secondaryRoles: ['Mid','Carry','Fill'] },
    { id: 'cmpq3uvq3000l3bs4xbhhjuld', name: 'FrankSrfromacctt',              role: 'Carry',   division: 'Hospice',        discordUsername: 'FrankSrfromAcct',  timezone: 'Central Standard Time (CST)', secondaryRoles: ['Carry'] },
    { id: 'cmpq3uv9o000k3bs4k4nrsw8b', name: 'GAMEOVER_ME234',                role: 'Support', division: 'Hospice',        discordUsername: 'GAMEOVER_ME234',   timezone: 'Central Standard Time (CST)', secondaryRoles: ['Mid'] },
    { id: 'cmpq3u06z000a3bs40h21f782', name: 'Guzzie',                        role: 'Mid',     division: 'Hospice',        discordUsername: 'Guzzie',           timezone: 'Pacific Standard Time (PST)', secondaryRoles: ['Mid'] },
    { id: 'cmpq3uwmx000n3bs481wtr8lt', name: 'ImSoThotful',                   role: 'Support', division: 'Hospice',        discordUsername: 'JimboDaThird',     timezone: 'Central Standard Time (CST)', secondaryRoles: ['Solo'] },
    { id: 'cmpq3u4ao000j3bs45qjigebz', name: 'JFS',                           role: 'Support', division: 'Hospice',        discordUsername: 'JFS',              timezone: 'Central Standard Time (CST)', secondaryRoles: ['Fill'] },
    { id: 'cmpq3u2h2000f3bs4oguvh8c0', name: 'LonewolfLC',                    role: 'Mid',     division: 'Hospice',        discordUsername: 'LonewolfLC',       timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Solo','Jungle','Mid','Support','Carry','Fill'] },
    { id: 'cmpq3tx0400033bs4x9wdmai0', name: 'meatshoess',                    role: 'Support', division: 'Hospice',        discordUsername: 'stickstaff',       timezone: 'Central Standard Time (CST)', secondaryRoles: ['Solo','Mid'] },
    { id: 'cmpq3u3ua000i3bs4g5nglptp', name: 'Oggunson',                      role: 'Support', division: 'Hospice',        discordUsername: 'Oggunson',         timezone: 'Central Standard Time (CST)', secondaryRoles: ['Fill'] },
    { id: 'cmpq3tw3a00013bs4mik5x27g', name: 'Ral175',                        role: 'Fill',    division: 'Hospice',        discordUsername: 'Ral175',           timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Fill'] },
    { id: 'cmpq3txwz00053bs4qn3qiz1o', name: 'Sir_Scoobthy',                  role: 'Mid',     division: 'Hospice',        discordUsername: 'Sir_Scoobthy',     timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Jungle'] },
    { id: 'cmpq3u2xg000g3bs42lvbsx0j', name: 'Smoollish',                     role: 'Support', division: 'Hospice',        discordUsername: 'smollish',         timezone: 'Mountain Standard Time (MST)', secondaryRoles: ['Support','Carry'] },
    { id: 'cmpq3u0nd000b3bs49l6qnu44', name: 'SoftballBlaze',                 role: 'Carry',   division: 'Hospice',        discordUsername: 'SoftballBlaze',    timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Mid','Support'] },
    { id: 'cmpq3u13t000c3bs4ych5i3il', name: 'Techttonixx',                   role: 'Support', division: 'Hospice',        discordUsername: 'Techtonixx',       timezone: 'GMT',                         secondaryRoles: ['Mid'] },
    { id: 'cmpq3u20m000e3bs45tyrjoi9', name: 'TheT1nyG1ant',                  role: 'Support', division: 'Hospice',        discordUsername: 'T1111ny',          timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Solo'] },
    { id: 'cmpq3u1k8000d3bs44lhi7ua9', name: 'xJungleScrub',                  role: 'Jungle',  division: 'Hospice',        discordUsername: 'Boomer',           timezone: 'Central Standard Time (CST)', secondaryRoles: ['Mid','Carry'] },
    { id: 'cmpq3tytr00073bs45cpsnipm', name: 'xXLordPoseidonXx',              role: 'Mid',     division: 'Hospice',        discordUsername: 'xXLordPoseidonXx', timezone: 'Pacific Standard Time (PST)', secondaryRoles: ['Mid','Carry'] },
    // Rehabilitation
    { id: 'cmpq3wlat000y3bs4efazy7te', name: 'alysaliustan',                  role: 'Mid',     division: 'Rehabilitation', discordUsername: 'itsjturner',       timezone: 'Central Standard Time (CST)', secondaryRoles: ['Solo','Support','Carry'] },
    { id: 'cmpq3wvdn001k3bs4locimt0l', name: 'Anon_Steve',                    role: 'Mid',     division: 'Rehabilitation', discordUsername: 'Anon_Steve',       timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Support','Carry'] },
    { id: 'cmpq3wt3j001f3bs41mgiy4zb', name: 'BigBlaclBanan69',               role: 'Solo',    division: 'Rehabilitation', discordUsername: 'Poppin certified', timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Mid','Support','Carry'] },
    { id: 'cmpq3woy700163bs4uvp25h0y', name: 'brotaco',                       role: 'Mid',     division: 'Rehabilitation', discordUsername: 'brotaco136',       timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Carry'] },
    { id: 'cmpq3wsn5001e3bs4yxltowwi', name: 'BuddyRabbit',                   role: 'Support', division: 'Rehabilitation', discordUsername: 'buddyrabbit (buddybrabbit not sure which one)', timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Jungle','Mid'] },
    { id: 'cmpq3wjxl000v3bs4fypkxdny', name: 'CrispeeHouse',                  role: 'Jungle',  division: 'Rehabilitation', discordUsername: 'CrispeeHouse',     timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Mid'] },
    { id: 'cmpq3wj0s000t3bs497ofm4wv', name: 'CrusteezNuts',                  role: 'Jungle',  division: 'Rehabilitation', discordUsername: 'CrusteezNuts',     timezone: 'Central Standard Time (CST)', secondaryRoles: ['Mid'] },
    { id: 'cmpq3wikd000s3bs4c8015jer', name: 'Dreaming',                      role: 'Jungle',  division: 'Rehabilitation', discordUsername: 'Dreamingxo',       timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Fill'] },
    { id: 'cmpq3wnkx00133bs4f017sg9x', name: 'Elo Terrorist',                 role: 'Solo',    division: 'Rehabilitation', discordUsername: 'JimJamtheSlimSlam',timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Support'] },
    { id: 'cmpq3wpv100183bs4kvkypvub', name: 'Eriayl',                        role: 'Jungle',  division: 'Rehabilitation', discordUsername: 'Eriayl',           timezone: 'GMT',                         secondaryRoles: ['Support'] },
    { id: 'cmpq3wi3y000r3bs4o37h9ktd', name: 'Ethereal with a lil line above it', role: 'Mid', division: 'Rehabilitation', discordUsername: 'imethereal',       timezone: 'Pacific Standard Time (PST)', secondaryRoles: ['Jungle'] },
    { id: 'cmpq3whnj000q3bs4s47oegi7', name: 'FARTHUFFFER4000',               role: 'Solo',    division: 'Rehabilitation', discordUsername: 'ojmannn',          timezone: 'Central Standard Time (CST)', secondaryRoles: ['Carry'] },
    { id: 'cmpq3wroo001c3bs4dbp76yrx', name: 'GreenDragon1102',               role: 'Jungle',  division: 'Rehabilitation', discordUsername: 'GreenDragon#2050', timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Mid'] },
    { id: 'cmpq3wmo100113bs47xv2z1fn', name: 'Helerine',                      role: 'Mid',     division: 'Rehabilitation', discordUsername: 'Duelerine',        timezone: 'Pacific Standard Time (PST)', secondaryRoles: ['Carry'] },
    { id: 'cmpq3wkue000x3bs467udil37', name: 'HerBlahaj',                     role: 'Support', division: 'Rehabilitation', discordUsername: 'Blahajprotector',  timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Support'] },
    { id: 'cmpq3wwqw001n3bs4runod8gy', name: 'iiPaniq',                       role: 'Carry',   division: 'Rehabilitation', discordUsername: 'Paniq',            timezone: 'Central Standard Time (CST)', secondaryRoles: ['Mid'] },
    { id: 'cmpq3wugt001i3bs41boikeai', name: 'inertia',                       role: 'Support', division: 'Rehabilitation', discordUsername: 'straxer',          timezone: 'Mountain Standard Time (MST)', secondaryRoles: ['Solo','Support'] },
    { id: 'cmpq3wvu2001l3bs4w0isu714', name: 'inspectorcody',                 role: 'Mid',     division: 'Rehabilitation', discordUsername: 'inspectorcody',    timezone: 'Central Standard Time (CST)', secondaryRoles: ['Support','Carry'] },
    { id: 'cmpq3wohs00153bs4f8xgn06d', name: 'JokesterRyan',                  role: 'Carry',   division: 'Rehabilitation', discordUsername: 'JokesterRyan',     timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Mid'] },
    { id: 'cmpq3wh75000p3bs4g5ba4hqp', name: 'JungleXJimmy',                  role: 'Jungle',  division: 'Rehabilitation', discordUsername: 'JungleXJimmy',     timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Solo','Mid','Support','Carry'] },
    { id: 'cmpq3wn4g00123bs46dup5xpm', name: 'KazaR-',                        role: 'Carry',   division: 'Rehabilitation', discordUsername: 'kazar5',           timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Jungle','Mid','Support','Carry'] },
    { id: 'cmpq3wx7b001o3bs4jds5tr0s', name: 'Lehightonking',                 role: 'Solo',    division: 'Rehabilitation', discordUsername: 'Lehightonking',    timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Solo','Mid'] },
    { id: 'cmpq3wr8a001b3bs4d2guyza3', name: 'LenKanu32',                     role: 'Jungle',  division: 'Rehabilitation', discordUsername: 'Len Kanu',         timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Mid','Carry'] },
    { id: 'cmpq3wm7l00103bs445pttuf3', name: 'Meisner',                       role: 'Support', division: 'Rehabilitation', discordUsername: 'meisner.',         timezone: 'Pacific Standard Time (PST)', secondaryRoles: ['Solo','Mid','Carry'] },
    { id: 'cmpq3wo1d00143bs4ibl70ytn', name: 'Meowdy',                        role: 'Jungle',  division: 'Rehabilitation', discordUsername: 'immakani',         timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Solo','Support'] },
    { id: 'cmpq3wy46001q3bs4gh8g63c7', name: 'Mikeyboy69',                    role: 'Mid',     division: 'Rehabilitation', discordUsername: 'mikey5885',        timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Jungle'] },
    { id: 'cmpq3wke0000w3bs4la7yz1q2', name: 'Ner0K5',                        role: 'Jungle',  division: 'Rehabilitation', discordUsername: 'Ner0',             timezone: 'Central Standard Time (CST)', secondaryRoles: ['Fill'] },
    { id: 'cmpq3wz10001s3bs4voy3pjzz', name: 'NotABigDeaIl',                  role: 'Mid',     division: 'Rehabilitation', discordUsername: 'Marchey_',         timezone: 'Other',                       secondaryRoles: ['Solo'] },
    { id: 'cmpq3wwah001m3bs48pvnsvm7', name: 'OoBlizzado',                    role: 'Support', division: 'Rehabilitation', discordUsername: 'Blizzado',         timezone: 'Central Standard Time (CST)', secondaryRoles: ['Jungle','Mid','Carry'] },
    { id: 'cmpq3wykl001r3bs4qfo8gqu8', name: 'ORIONPAX',                      role: 'Solo',    division: 'Rehabilitation', discordUsername: 'orionpax009',      timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Solo'] },
    { id: 'cmpq3ws6q001d3bs4vn4mmoze', name: 'Pineappleislazy',               role: 'Mid',     division: 'Rehabilitation', discordUsername: 'pineappleislazy',  timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Solo','Jungle'] },
    { id: 'cmpq3wjh6000u3bs4nnrrecmk', name: 'SabrinaGapenter',               role: 'Support', division: 'Rehabilitation', discordUsername: 'Diese',            timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Fill'] },
    { id: 'cmpq3wqbg00193bs4qn9bkhnp', name: 'SerpentSypha',                  role: 'Solo',    division: 'Rehabilitation', discordUsername: 'Mommysypha',       timezone: 'Mountain Standard Time (MST)', secondaryRoles: ['Fill'] },
    { id: 'cmpq3wux7001j3bs4yuxiaokw', name: 'Slammincody',                   role: 'Support', division: 'Rehabilitation', discordUsername: 'slammincody',      timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Solo','Support'] },
    { id: 'cmpq3wtjy001g3bs4bbkz0ggz', name: 'SmallFace',                     role: 'Solo',    division: 'Rehabilitation', discordUsername: 'SmallerFace',      timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Fill'] },
    { id: 'cmpq3wpel00173bs4u0g5is4w', name: 'Sultaisimp',                    role: 'Jungle',  division: 'Rehabilitation', discordUsername: 'Berrytoppings',    timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Solo'] },
    { id: 'cmpq3wqrv001a3bs44asr7uec', name: 'The Brawn Jame',                role: 'Fill',    division: 'Rehabilitation', discordUsername: 'perbomba',         timezone: 'Central Standard Time (CST)', secondaryRoles: ['Fill'] },
    { id: 'cmpq3wlr7000z3bs41gawzmu1', name: 'Thorce',                        role: 'Carry',   division: 'Rehabilitation', discordUsername: 'Thorce',           timezone: 'Eastern Standard Time (EST)', secondaryRoles: [] },
    { id: 'cmpq3wu0e001h3bs4tf4p6rtr', name: 'treestoompzz',                  role: 'Mid',     division: 'Rehabilitation', discordUsername: 'stoomp',           timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Solo','Support'] },
    { id: 'cmpq3wxnq001p3bs4rorkwthj', name: 'Tyl3r2k',                       role: 'Carry',   division: 'Rehabilitation', discordUsername: 'Tyl3r2k',          timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Fill'] },
    { id: 'cmpq3wgqq000o3bs4h6v4wxb1', name: 'XxSemonxX',                     role: 'Carry',   division: 'Rehabilitation', discordUsername: 'XxSemonxX',        timezone: 'Eastern Standard Time (EST)', secondaryRoles: ['Fill'] },
  ];

  for (const { id, ...fields } of players) {
    await prisma.player.upsert({
      where: { id },
      update: fields,
      create: { id, ...fields },
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

  // ── Teams (with captainPlayerId) ──────────────────
  const teams = [
    // Hospice division
    { id: 'team-caustic-crusaders',  name: 'Caustic Crusaders',     tag: 'CC',  divisionId: 'div-s9-hospice',        captainPlayerId: 'cmpq3uw6i000m3bs4cfcb9hhg' },
    { id: 'team-death-dealers',      name: 'Death Dealers',          tag: 'DD',  divisionId: 'div-s9-hospice',        captainPlayerId: 'cmpq3uvq3000l3bs4xbhhjuld' },
    { id: 'team-galactic-stingers',  name: 'The Galactic Stingers',  tag: 'GS',  divisionId: 'div-s9-hospice',        captainPlayerId: 'cmpq3uwmx000n3bs481wtr8lt' },
    { id: 'team-wheezys-mafia',      name: "Wheezy's Mafia",         tag: 'WM',  divisionId: 'div-s9-hospice',        captainPlayerId: 'cmpq3uv9o000k3bs4k4nrsw8b' },
    // Rehabilitation division
    { id: 'team-babas-kitchen',      name: "Baba's Kitchen",         tag: 'BK',  divisionId: 'div-s9-rehabilitation', captainPlayerId: 'cmpq3wz10001s3bs4voy3pjzz' },
    { id: 'team-cyberpunk-otters',   name: 'Cyberpunk Otters',       tag: 'CPO', divisionId: 'div-s9-rehabilitation', captainPlayerId: 'cmpq3wxnq001p3bs4rorkwthj' },
    { id: 'team-exile-extinction',   name: 'Exile Extinction',       tag: 'EE',  divisionId: 'div-s9-rehabilitation', captainPlayerId: 'cmpq3wwqw001n3bs4runod8gy' },
    { id: 'team-kappa-corp',         name: 'Kappa Corp',             tag: 'KC',  divisionId: 'div-s9-rehabilitation', captainPlayerId: 'cmpq3wx7b001o3bs4jds5tr0s' },
    { id: 'team-ruined-order',       name: 'The Ruined Order',       tag: 'TRO', divisionId: 'div-s9-rehabilitation', captainPlayerId: 'cmpq3wy46001q3bs4gh8g63c7' },
    { id: 'team-valhalla-vikings',   name: 'Valhalla Vikings',       tag: 'VV',  divisionId: 'div-s9-rehabilitation', captainPlayerId: 'cmpq3wykl001r3bs4qfo8gqu8' },
  ];

  for (const { id, divisionId, captainPlayerId, ...fields } of teams) {
    await prisma.team.upsert({
      where: { id },
      update: { ...fields, captainPlayerId },
      create: { id, divisionId, captainPlayerId, ...fields },
    });
  }
  console.log(`  ✓ ${teams.length} teams seeded`);

  // ── TeamMembers — S9 captains ─────────────────────
  // IDs are real cuid values from production DB so upserts are idempotent.
  const captainMembers = [
    { id: 'cmpq42ibi0003148b2jy420jn', teamId: 'team-caustic-crusaders',  playerId: 'cmpq3uw6i000m3bs4cfcb9hhg', role: 'Support', isCaptain: true },
    { id: 'cmpq41x3h0001148b1u9jwkg7', teamId: 'team-death-dealers',      playerId: 'cmpq3uvq3000l3bs4xbhhjuld', role: 'Carry',   isCaptain: true },
    { id: 'cmpq42x2t0005148bbp2u87vy', teamId: 'team-galactic-stingers',  playerId: 'cmpq3uwmx000n3bs481wtr8lt', role: 'Support', isCaptain: true },
    { id: 'cmpq43g960007148bh1vev88z', teamId: 'team-wheezys-mafia',      playerId: 'cmpq3uv9o000k3bs4k4nrsw8b', role: 'Support', isCaptain: true },
    { id: 'cmpq45k7k000j148bu8kp39i1', teamId: 'team-babas-kitchen',      playerId: 'cmpq3wz10001s3bs4voy3pjzz', role: 'Mid',     isCaptain: true },
    { id: 'cmpq4524t000f148bt9r6kk2n', teamId: 'team-cyberpunk-otters',   playerId: 'cmpq3wxnq001p3bs4rorkwthj', role: 'Carry',   isCaptain: true },
    { id: 'cmpq43vi10009148bfyefwxdw', teamId: 'team-exile-extinction',   playerId: 'cmpq3wwqw001n3bs4runod8gy', role: 'Carry',   isCaptain: true },
    { id: 'cmpq44e6n000b148bgen91gsp', teamId: 'team-kappa-corp',         playerId: 'cmpq3wx7b001o3bs4jds5tr0s', role: 'Solo',    isCaptain: true },
    { id: 'cmpq45bbw000h148bq70kp1n1', teamId: 'team-ruined-order',       playerId: 'cmpq3wy46001q3bs4gh8g63c7', role: 'Mid',     isCaptain: true },
    { id: 'cmpq44r1y000d148bik6brsjp', teamId: 'team-valhalla-vikings',   playerId: 'cmpq3wykl001r3bs4qfo8gqu8', role: 'Solo',    isCaptain: true },
  ];

  for (const { id, ...fields } of captainMembers) {
    await prisma.teamMember.upsert({
      where: { id },
      update: { isCaptain: true },
      create: { id, ...fields },
    });
  }
  console.log(`  ✓ ${captainMembers.length} captain TeamMembers seeded`);

  console.log('\n✅ Seed complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
