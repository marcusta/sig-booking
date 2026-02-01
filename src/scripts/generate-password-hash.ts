import { hashPassword } from "../utils/hash";
import path from "path";

const USERS_PATH = path.join(process.cwd(), "data", "users.json");

async function main() {
  if (process.argv.length < 4) {
    console.log("Usage: bun run src/scripts/generate-password-hash.ts <username> <password>");
    process.exit(1);
  }

  const username = process.argv[2];
  const password = process.argv[3];
  const passwordHash = await hashPassword(password);

  const existing = await Bun.file(USERS_PATH).json().catch(() => ({ users: [] }));
  const users = existing.users.filter((u: any) => u.username !== username);
  users.push({ username, passwordHash });

  await Bun.write(USERS_PATH, JSON.stringify({ users }, null, 2) + "\n");
  console.log(`Updated ${USERS_PATH} — user "${username}" hash written.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
