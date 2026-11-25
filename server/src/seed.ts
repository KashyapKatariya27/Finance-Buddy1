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

    console.log("Seeding demo accounts for FinanceBuddy (Midnight Aurora)...");
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
        everydayCents: 1250000, // $12,500
        emergencyCents: 1500000, // $15,000
        savingsCents: 2250000, // $22,500
        splitEveryday: 50,
        splitEmergency: 20,
        splitSavings: 30,
        monthlyExpensesCents: 350000, // $3,500/mo
        streakDays: 14
      }
    });

    // 2. Leo Jenkins - Family Child (Age 10)
    const leo = await db.user.create({
      data: {
        fullName: "Leo Jenkins",
        email: "leo@demo.com",
        passwordHash,
        role: "CHILD",
        accountMode: "FAMILY",
        age: 10,
        currency: "USD",
        parentId: sarah.id,
        everydayCents: 3500, // $35
        emergencyCents: 1500, // $15
        savingsCents: 5000, // $50
        splitEveryday: 50,
        splitEmergency: 20,
        splitSavings: 30,
        monthlyExpensesCents: 5000,
        streakDays: 7
      }
    });

    // Leo's Goal: LEGO Spaceship ($100 target, $50 saved)
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
        everydayCents: 4500000, // ₹45,000
        emergencyCents: 9000000, // ₹90,000 (3 months runway)
        savingsCents: 7500000, // ₹75,000
        splitEveryday: 50,
        splitEmergency: 20,
        splitSavings: 30,
        monthlyExpensesCents: 3000000, // ₹30,000/mo
        streakDays: 21
      }
    });

    // Riya's Goals: Japan Trip & Emergency Cushion
    await db.goal.create({
      data: {
        userId: riya.id,
        name: "Kyoto Autumn Expedition",
        category: "travel",
        targetCents: 15000000, // ₹150,000
        currentCents: 7500000, // ₹75,000 (50%)
        deadline: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        priority: "high",
        icon: "⛩️",
        autoSaveCents: 1500000,
        autoSaveFrequency: "monthly",
        roundUpEnabled: true,
        status: "active"
      }
    });

    // 4. Aman Verma - Teen / Student (Age 19)
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
        everydayCents: 1200000, // ₹12,000
        emergencyCents: 600000, // ₹6,000
        savingsCents: 1800000, // ₹18,000
        splitEveryday: 50,
        splitEmergency: 20,
        splitSavings: 30,
        monthlyExpensesCents: 1000000,
        streakDays: 9
      }
    });

    // Aman's Goal: Coding Laptop
    await db.goal.create({
      data: {
        userId: aman.id,
        name: "M3 Pro Development Rig",
        category: "gadget",
        targetCents: 12000000, // ₹120,000
        currentCents: 4500000, // ₹45,000 (37.5%)
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        priority: "high",
        icon: "💻",
        autoSaveCents: 1000000,
        autoSaveFrequency: "monthly",
        roundUpEnabled: true,
        status: "active"
      }
    });

    console.log("Demo seed data created successfully!");
  } catch (err) {
    console.error("Seed error:", err);
  } finally {
    isSeeding = false;
  }
}
