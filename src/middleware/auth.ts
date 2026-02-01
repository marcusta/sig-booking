import fs from "fs/promises";
import jwt from "jsonwebtoken";
import path from "path";
import { verifyPassword } from "../utils/hash";
import logger from "../logger";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is required");

interface User {
  username: string;
  passwordHash: string;
}

interface UsersFile {
  users: User[];
}

// Function to load users from JSON file
async function loadUsers(): Promise<UsersFile> {
  try {
    const filePath = path.join(process.cwd(), "data", "users.json");
    const fileContent = await fs.readFile(filePath, "utf-8");
    return JSON.parse(fileContent) as UsersFile;
  } catch (error) {
    logger.error("Error loading users file:", { error });
    return { users: [] };
  }
}

// Pure authentication functions
export async function createSessionToken(username: string): Promise<string> {
  return new Promise((resolve, reject) => {
    jwt.sign({ username }, JWT_SECRET, { expiresIn: "24h" }, (err, token) => {
      if (err) reject(err);
      else resolve(token as string);
    });
  });
}

export async function verifySessionToken(
  token: string | undefined
): Promise<boolean> {
  if (!token) return false;

  return new Promise((resolve) => {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) resolve(false);
      else resolve(true);
    });
  });
}

export async function validateCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const { users } = await loadUsers();
  logger.debug("Validating credentials", { username });
  const user = users.find((u) => u.username === username);
  if (!user) return false;

  return await verifyPassword(password, user.passwordHash);
}
