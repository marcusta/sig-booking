// NOTE: This uses bcrypt via Bun's built-in password API.
// Existing users.json entries with SHA256 hashes will need to be regenerated
// using generate-password-hash.ts and manually updated in users.json.

export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash);
}
