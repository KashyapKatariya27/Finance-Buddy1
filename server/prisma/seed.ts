import { seedDemoAccounts } from "../src/seed";

seedDemoAccounts()
  .then(() => {
    console.log("Seed script completed.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed script failed:", err);
    process.exit(1);
  });
