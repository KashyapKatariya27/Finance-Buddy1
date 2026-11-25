import app from "./app";
import { PORT, HOST } from "./config";

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, HOST, () => {
    console.log(`✨ FinanceBuddy Server running at http://${HOST}:${PORT}`);
  });
}
