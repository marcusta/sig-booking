import fs from "fs/promises";
import jwt from "jsonwebtoken";
import path from "path";
import { hashPassword } from "../utils/hash";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"; // Should be set via environment variable

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
    console.error("Error loading users file:", error);
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
  const user = users.find((u) => u.username === username);
  if (!user) return false;

  const hashedPassword = await hashPassword(password);
  return user.passwordHash === hashedPassword;
}

// Optional: If you need the decoded token data
export async function decodeToken(
  token: string
): Promise<{ username: string } | null> {
  return new Promise((resolve) => {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) resolve(null);
      else resolve(decoded as { username: string });
    });
  });
}

// Types for JWT handlers
export type JWTHandler = {
  sign: (payload: any) => Promise<string>;
  verify: (token: string) => Promise<any>;
};
