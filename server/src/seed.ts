import bcrypt from "bcryptjs";
import db from "./db";

let isSeeding = false;

export async function seedDemoAccounts() {
  if (isSeeding) return;
  isSeeding = true;

  try {
    const existingCount = (await db.user.findMany()).length;
    if (existingCount > 0) {
      isSeeding = false;
      return;
    }

    console.log("Seeding demo accounts for FinanceBuddy...");
    const passwordHash = await bcrypt.hash("password123", 10);

    // 1. Sarah Jenkins - Family Parent
    const sarah = await db.user.create({
      data: {
        fullName: "Sarah Jenkins",
        email: "sarah@demo.com",
        passwordHash,
        role: "PARENT",
        accountMode: "FAMILY",
        age: 38,
        currency: "USD",
        streakDays: 14,
        wallet: {
          create: {
            everydayCents: 1250000,
            emergencyCents: 1500000,
            savingsCents: 2250000
          }
        },
        plan: {
          create: {
            splitEveryday: 50,
            splitEmergency: 20,
            splitSavings: 30,
            monthlyExpensesCents: 350000
          }
        }
      }
    });

    // 2. Leo Jenkins - Family Child (Age 14)
    const leo = await db.user.create({
      data: {
        fullName: "Leo Jenkins",
        email: "leo@demo.com",
        passwordHash,
        role: "CHILD",
        accountMode: "FAMILY",
        age: 14,
        currency: "USD",
        parentId: sarah.id,
        streakDays: 7,
        wallet: {
          create: {
            everydayCents: 3500,
            emergencyCents: 1500,
            savingsCents: 5000
          }
        },
        plan: {
          create: {
            splitEveryday: 50,
            splitEmergency: 30,
            splitSavings: 20,
            monthlyExpensesCents: 5000
          }
        }
      }
    });

    await db.goal.create({
      data: {
        userId: leo.id,
        name: "Galactic Explorer LEGO Set",
        category: "gadget",
        targetCents: 10000,
        currentCents: 5000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        priority: "high",
        icon: "🚀",
        autoSaveCents: 500,
        autoSaveFrequency: "weekly",
        roundUpEnabled: true,
        status: "active"
      }
    });

    await db.chore.create({
      data: {
        parentId: sarah.id,
        childId: leo.id,
        title: "Clean & Organize Study Desk",
        description: "Put away textbooks and wipe down desk surface.",
        rewardCents: 1000, // $10.00
        status: "pending"
      }
    });

    // 3. Riya Sharma - Individual Adult (Age 26)
    const riya = await db.user.create({
      data: {
        fullName: "Riya Sharma",
        email: "riya@demo.com",
        passwordHash,
        role: "INDIVIDUAL",
        accountMode: "MYSELF",
        age: 26,
        currency: "INR",
        streakDays: 21,
        wallet: {
          create: {
            everydayCents: 4500000,
            emergencyCents: 9000000,
            savingsCents: 7500000
          }
        },
        plan: {
          create: {
            splitEveryday: 50,
            splitEmergency: 30,
            splitSavings: 20,
            monthlyExpensesCents: 3000000
          }
        }
      }
    });

    await db.goal.create({
      data: {
        userId: riya.id,
        name: "Kyoto Autumn Expedition",
        category: "travel",
        targetCents: 15000000,
        currentCents: 7500000,
        deadline: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        priority: "high",
        icon: "⛩️",
        autoSaveCents: 1500000,
        autoSaveFrequency: "monthly",
        roundUpEnabled: true,
        status: "active"
      }
    });

    // 4. Aman Verma - Student (Age 19)
    const aman = await db.user.create({
      data: {
        fullName: "Aman Verma",
        email: "aman@demo.com",
        passwordHash,
        role: "INDIVIDUAL",
        accountMode: "TEEN",
        age: 19,
        currency: "INR",
        accountabilityPartnerEmail: "mentor@demo.com",
        streakDays: 9,
        wallet: {
          create: {
            everydayCents: 1200000,
            emergencyCents: 600000,
            savingsCents: 1800000
          }
        },
        plan: {
          create: {
            splitEveryday: 50,
            splitEmergency: 20,
            splitSavings: 30,
            monthlyExpensesCents: 1000000
          }
        }
      }
    });

    await db.goal.create({
      data: {
        userId: aman.id,
        name: "M3 Pro Development Rig",
        category: "gadget",
        targetCents: 12000000,
        currentCents: 4500000,
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        priority: "high",
        icon: "💻",
        autoSaveCents: 1000000,
        autoSaveFrequency: "monthly",
        roundUpEnabled: true,
        status: "active"
      }
    });

    console.log("\n✅ Demo Seed Accounts Ready:");
    console.log("  1. Sarah Jenkins (PARENT): sarah@demo.com / password123");
    console.log("  2. Leo Jenkins   (CHILD, 14): leo@demo.com / password123");
    console.log("  3. Riya Sharma   (INDIVIDUAL): riya@demo.com / password123");
    console.log("  4. Aman Verma    (STUDENT): aman@demo.com / password123\n");
  } catch (err) {
    console.error("Seed error:", err);
  } finally {
    isSeeding = false;
  }
}
