export const JWT_SECRET = process.env.JWT_SECRET!;

if (!JWT_SECRET) {
  throw new Error("❌ JWT_SECRET is not set in .env");
}
