import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

interface UsersFile {
  salt: string;
  users: Array<{
    username: string;
    passwordHash: string;
  }>;
}

async function getSalt(): Promise<string> {
  try {
    const filePath = path.join(process.cwd(), "data", "users.json");
    const fileContent = await fs.readFile(filePath, "utf-8");
    const usersFile = JSON.parse(fileContent) as UsersFile;
    return usersFile.salt;
  } catch (error) {
    console.error("Error reading salt from users file:", error);
    throw new Error("Could not read salt from users file");
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await getSalt();
  return crypto
    .createHash("sha256")
    .update(salt + password)
    .digest("hex");
}
