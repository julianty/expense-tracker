/**
 * Seed the demo data into Supabase.
 *
 * Plain CommonJS so it runs with `node prisma/seed.cjs` (no ts-node needed).
 * Uses explicit ids (tahoe / m-alex / e-dinner …) so the landing page and demo
 * links stay stable. Idempotent: clears the tables first, then re-inserts.
 *
 * Shares are stored as zero-sum net rows (payer negative, debtors positive),
 * matching the ledger contract. net = grossOwed - amountPaid.
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/** Even split in integer cents; remainder penny goes to the payer (deterministic). */
function equalGross(total, n, payerIdx) {
  const base = Math.trunc(total / n);
  const remainder = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i === payerIdx ? remainder : 0));
}

/** Build {payments, shares} for an equal-split expense with one payer. `total` is base-currency cents. */
function equalExpense(total, memberIds, payerId) {
  const payerIdx = memberIds.indexOf(payerId);
  const gross = equalGross(total, memberIds.length, payerIdx);
  const shares = memberIds
    .map((memberId, i) => ({
      memberId,
      amountCents: gross[i] - (memberId === payerId ? total : 0),
    }))
    .filter((s) => s.amountCents !== 0);
  return {
    payments: [{ memberId: payerId, amountCents: total }],
    shares,
  };
}

async function main() {
  // --- clear (FK-safe order) ---
  await prisma.auditLog.deleteMany();
  await prisma.expenseShare.deleteMany();
  await prisma.expensePayment.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();

  // --- users (creators) ---
  await prisma.user.createMany({
    data: [
      { id: "u-alex", email: "alex@example.com" },
      { id: "u-jo", email: "jo@example.com" },
      { id: "u-sam", email: "sam@example.com" },
    ],
  });

  // --- Tahoe trip (demo / hub) ---
  await prisma.group.create({
    data: {
      id: "tahoe",
      name: "Tahoe trip",
      baseCurrency: "USD",
      shareToken: "x7Qa9k2mDt",
      simplifyDebts: true,
      createdByUserId: "u-alex",
      members: {
        create: [
          { id: "m-alex", displayName: "Alex", claimedByUserId: "u-alex" },
          { id: "m-bo", displayName: "Bo" },
          { id: "m-cam", displayName: "Cam" },
        ],
      },
    },
  });

  const tahoeMembers = ["m-alex", "m-bo", "m-cam"];
  const tahoeExpenses = [
    { id: "e-dinner", description: "Dinner", total: 8400, payer: "m-alex", date: "2026-06-14T21:21:00" },
    { id: "e-lift", description: "Lift tickets", total: 21000, payer: "m-bo", date: "2026-06-13T11:10:00" },
    { id: "e-groceries", description: "Groceries", total: 5630, payer: "m-cam", date: "2026-06-12T17:30:00" },
  ];
  for (const x of tahoeExpenses) {
    const { payments, shares } = equalExpense(x.total, tahoeMembers, x.payer);
    await prisma.expense.create({
      data: {
        id: x.id,
        groupId: "tahoe",
        description: x.description,
        date: new Date(x.date),
        currency: "USD",
        fxRate: 1,
        splitMode: "equal",
        createdByMemberId: x.payer,
        payments: { create: payments },
        shares: { create: shares },
      },
    });
    await prisma.auditLog.create({
      data: {
        groupId: "tahoe",
        actorMemberId: x.payer,
        action: `added '${x.description}'`,
        kind: "create",
        amountCents: x.total,
        entityType: "expense",
        entityId: x.id,
        createdAt: new Date(x.date),
      },
    });
  }

  // Multi-currency expense: €90 ski wax @ 1.08 USD/EUR → $97.20 base, split equally.
  {
    const baseTotal = Math.round(90 * 100 * 1.08); // 9720 cents USD
    const { payments, shares } = equalExpense(baseTotal, tahoeMembers, "m-alex");
    await prisma.expense.create({
      data: {
        id: "e-skiwax",
        groupId: "tahoe",
        description: "Ski wax",
        date: new Date("2026-06-15T10:00:00"),
        currency: "EUR",
        fxRate: 1.08,
        splitMode: "equal",
        createdByMemberId: "m-alex",
        payments: { create: payments },
        shares: { create: shares },
      },
    });
    await prisma.auditLog.create({
      data: {
        groupId: "tahoe",
        actorMemberId: "m-alex",
        action: "added 'Ski wax'",
        kind: "create",
        amountCents: baseTotal,
        entityType: "expense",
        entityId: "e-skiwax",
        createdAt: new Date("2026-06-15T10:00:00"),
      },
    });
  }

  // --- Apartment 4B ---
  await prisma.group.create({
    data: {
      id: "apt4b",
      name: "Apartment 4B",
      baseCurrency: "USD",
      shareToken: "p3Lm8nQr5w",
      simplifyDebts: true,
      createdByUserId: "u-jo",
      members: {
        create: [
          { id: "m-jo", displayName: "Jo", claimedByUserId: "u-jo" },
          { id: "m-mi", displayName: "Mi" },
          { id: "m-ro", displayName: "Ro" },
          { id: "m-sky", displayName: "Sky" },
          { id: "m-tay", displayName: "Tay" },
        ],
      },
    },
  });
  {
    const aptMembers = ["m-jo", "m-mi", "m-ro", "m-sky", "m-tay"];
    const { payments, shares } = equalExpense(310000, aptMembers, "m-mi");
    await prisma.expense.create({
      data: {
        id: "e-rent",
        groupId: "apt4b",
        description: "Rent — June",
        date: new Date("2026-06-01T09:00:00"),
        currency: "USD",
        fxRate: 1,
        splitMode: "equal",
        createdByMemberId: "m-mi",
        payments: { create: payments },
        shares: { create: shares },
      },
    });
    await prisma.auditLog.create({
      data: {
        groupId: "apt4b",
        actorMemberId: "m-mi",
        action: "added 'Rent — June'",
        kind: "create",
        amountCents: 310000,
        entityType: "expense",
        entityId: "e-rent",
        createdAt: new Date("2026-06-01T09:00:00"),
      },
    });
  }

  // --- Book club (settled, no expenses) ---
  await prisma.group.create({
    data: {
      id: "bookclub",
      name: "Book club",
      baseCurrency: "USD",
      shareToken: "k9Zt2vBc4x",
      simplifyDebts: false,
      createdByUserId: "u-sam",
      members: {
        create: [
          { id: "m-sam", displayName: "Sam", claimedByUserId: "u-sam" },
          { id: "m-dee", displayName: "Dee" },
        ],
      },
    },
  });

  const counts = {
    groups: await prisma.group.count(),
    members: await prisma.groupMember.count(),
    expenses: await prisma.expense.count(),
    shares: await prisma.expenseShare.count(),
    audit: await prisma.auditLog.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
