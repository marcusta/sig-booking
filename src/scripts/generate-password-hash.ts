import { hashPassword } from "../utils/hash";

async function main() {
  if (process.argv.length < 3) {
    console.log("Usage: ts-node generate-password-hash.ts <password>");
    process.exit(1);
  }

  const password = process.argv[2];
  const hash = await hashPassword(password);
  console.log("Password Hash:", hash);
}

main().catch(console.error);
