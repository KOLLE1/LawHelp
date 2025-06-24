import { createInsertSchema } from 'drizzle-zod';
import { mysqlTable, varchar, text, timestamp, boolean, int, decimal, json, mysqlEnum } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

// Users table
export const users = mysqlTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  role: mysqlEnum("role", ["user", "lawyer", "admin"]).default("user"),
  isLawyer: boolean("is_lawyer").default(false),
  emailVerified: boolean("email_verified").default(false),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorMethod: varchar("two_factor_method", { length: 50 }),
  twoFactorSecret: varchar("two_factor_secret", { length: 255 }),
  backupCodes: json("backup_codes"),
  location: varchar("location", { length: 255 }),
  profileImageUrl: varchar("profile_image_url", { length: 500 }),
  lastActive: timestamp("last_active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Chat sessions table
export const chatSessions = mysqlTable("chat_sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["active", "completed", "archived"]).default("active"),
  language: mysqlEnum("language", ["en", "fr"]).default("en"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Chat messages table
export const chatMessages = mysqlTable("chat_messages", {
  id: varchar("id", { length: 255 }).primaryKey(),
  sessionId: varchar("session_id", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 100 }),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  referencesData: json("references_data"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Lawyers table
export const lawyers = mysqlTable("lawyers", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  licenseNumber: varchar("license_number", { length: 100 }).notNull().unique(),
  specialization: json("specialization").notNull(),
  experienceYears: int("experience_years").notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  languages: json("languages").notNull(),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  bio: text("bio"),
  education: json("education"),
  certifications: json("certifications"),
  availabilitySchedule: json("availability_schedule"),
  isVerified: boolean("is_verified").default(false),
  rating: decimal("rating", { precision: 2, scale: 1 }).default("0.0"),
  totalRatings: int("total_ratings").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Lawyer ratings table
export const lawyerRatings = mysqlTable("lawyer_ratings", {
  id: varchar("id", { length: 255 }).primaryKey(),
  lawyerId: varchar("lawyer_id", { length: 255 }).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  rating: int("rating").notNull(),
  review: text("review"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Verification codes table
export const verificationCodes = mysqlTable("verification_codes", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  code: varchar("code", { length: 10 }).notNull(),
  type: mysqlEnum("type", ["email_verification", "password_reset", "two_factor"]).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notifications table
export const notifications = mysqlTable("notifications", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: mysqlEnum("type", ["info", "warning", "success", "error"]).default("info"),
  readStatus: boolean("read_status").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sessions table for express-session
export const sessions = mysqlTable("sessions", {
  sessionId: varchar("session_id", { length: 128 }).primaryKey(),
  expires: int("expires").notNull(),
  data: text("data"),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  chatSessions: many(chatSessions),
  lawyers: many(lawyers),
  lawyerRatings: many(lawyerRatings),
  verificationCodes: many(verificationCodes),
  notifications: many(notifications),
}));

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [chatSessions.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
}));

export const lawyersRelations = relations(lawyers, ({ one, many }) => ({
  user: one(users, {
    fields: [lawyers.userId],
    references: [users.id],
  }),
  ratings: many(lawyerRatings),
}));

export const lawyerRatingsRelations = relations(lawyerRatings, ({ one }) => ({
  lawyer: one(lawyers, {
    fields: [lawyerRatings.lawyerId],
    references: [lawyers.id],
  }),
  user: one(users, {
    fields: [lawyerRatings.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});



export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertLawyerSchema = createInsertSchema(lawyers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLawyerRatingSchema = createInsertSchema(lawyerRatings).omit({
  id: true,
  createdAt: true,
});

export const insertVerificationCodeSchema = createInsertSchema(verificationCodes).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type Lawyer = typeof lawyers.$inferSelect;
export type InsertLawyer = z.infer<typeof insertLawyerSchema>;
export type LawyerRating = typeof lawyerRatings.$inferSelect;
export type InsertLawyerRating = z.infer<typeof insertLawyerRatingSchema>;
export type VerificationCode = typeof verificationCodes.$inferSelect;
export type InsertVerificationCode = z.infer<typeof insertVerificationCodeSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;