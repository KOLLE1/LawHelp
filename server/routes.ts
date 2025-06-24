import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage-mysql";
import { aiLegalService } from "./ai-service";
import { twoFactorService } from "./2fa-service";
import { metricsHandler, healthHandler, metricsCollector } from "./metrics";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { insertUserSchema, insertChatSessionSchema, insertChatMessageSchema } from "../shared/schema";
import { PassThrough } from "stream";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key";

// WebSocket connections map
const wsConnections = new Map<string, WebSocket>();

// Middleware for JWT authentication
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
}

// Generate random code for 2FA
function generateVerificationCode(): string {
  return twoFactorService.generateEmailCode();
}

// Send verification code using FormSubmit
async function sendVerificationCode(email: string, code: string, type: string): Promise<void> {
  try {
    await twoFactorService.sendEmailCode(email, code, type);
  } catch (error) {
    console.error('Failed to send verification email:', error);
    // For development purposes, also log the code
    console.log(`Verification code for ${email} (${type}): ${code}`);
    throw error;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // // Initialize storage
  // const storage = await initializeStorage();

  console.log(storage)
  // WebSocket server setup
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws'
  });

  wss.on('connection', (ws: WebSocket, req) => {
    console.log('WebSocket connection established');

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'auth') {
          // Authenticate WebSocket connection
          try {
            const decoded = jwt.verify(message.token, JWT_SECRET) as any;
            wsConnections.set(decoded.userId, ws);
            ws.send(JSON.stringify({ type: 'auth_success' }));
          } catch (error) {
            ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }));
          }
        } else if (message.type === 'chat_message') {
          // Handle real-time chat messages
          const { sessionId, content, userId } = message;

          // Save user message
          const userMessage = await storage.createChatMessage({
            sessionId,
            content,
            role: 'user',
          });

          // Broadcast user message
          ws.send(JSON.stringify({
            type: 'message_sent',
            message: userMessage,
          }));

          // Get AI response
          try {
            const aiResponse = await aiLegalService.processLegalQuery({
              question: content,
              language: 'en', // TODO: detect language from user preferences
            });

            // Save AI message
            const aiMessage = await storage.createChatMessage({
              sessionId,
              content: aiResponse.answer,
              role: 'assistant',
              category: aiResponse.category,
              confidence: aiResponse.confidence.toString(),
              referencesData: aiResponse.references,
            });

            // Broadcast AI response
            ws.send(JSON.stringify({
              type: 'ai_response',
              message: aiMessage,
            }));

            // Update session title if it's the first message
            const messages = await storage.getChatMessages(sessionId);
            if (messages.length === 2) { // User message + AI response
              const title = content.length > 50 ? content.substring(0, 50) + '...' : content;
              await storage.updateChatSession(sessionId, { title });
            }
          } catch (error) {
            console.error('AI service error:', error);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Failed to get AI response. Please try again.',
            }));
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      // Remove connection from map
      for (const [userId, connection] of Array.from(wsConnections.entries())) {
        if (connection === ws) {
          wsConnections.delete(userId);
          break;
        }
      }
    });
  });

  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    try {

      const  { email, firstName, lastName, password } = req.body
      var password_hash = await bcrypt.hash(password, 12)
      var name = `${firstName} ${lastName}`
      const userData = insertUserSchema.parse({
        name:name,
        email:email,
        passwordHash:password_hash,
        lastName:lastName,
        firstName:firstName
      });

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists with this email' });
      }



      // Hash password
      const passwordHash = userData.passwordHash

      // Create user
      const user = await storage.createUser({
        ...userData,
        passwordHash,
        firstName: userData.name.split(' ')[0] || userData.name,
        lastName: userData.name.split(' ').slice(1).join(' ') || '',
      });

      // Generate email verification code
      const verificationCode = generateVerificationCode();
      await storage.createVerificationCode({
        userId: user.id,
        code: verificationCode,
        type: 'email_verification',
        used: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      // Send verification email
      await sendVerificationCode(user.email, verificationCode, 'email_verification');

      res.status(201).json({ 
        message: 'User registered successfully. Please check your email for verification code.',
        userId: user.id 
      });
    } catch (error) {
      console.error('Registration error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid user data', errors: error.errors });
      }
      res.status(500).json({ message: 'Registration failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      console.log(email, password)

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const user = await storage.getUserByEmail(email);

      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      if (!user.emailVerified) {
        return res.status(401).json({ message: 'Please verify your email before logging in' });
      }

      // Check if 2FA is enabled
      if (user.twoFactorEnabled) {
        const twoFactorCode = generateVerificationCode();
        await storage.createVerificationCode({
          userId: user.id,
          code: twoFactorCode,
          type: 'two_factor',
          used: false,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        });

        await sendVerificationCode(user.email, twoFactorCode, 'two_factor');

        return res.json({ 
          requiresTwoFactor: true,
          userId: user.id,
          message: 'Please enter the verification code sent to your email'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Update last active
      await storage.updateUser(user.id, { lastActive: new Date() });

      res.json({ 
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isLawyer: user.isLawyer,
          twoFactorEnabled: user.twoFactorEnabled,
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  app.post('/api/auth/verify-email', async (req, res) => {
    try {
      const { userId, code } = req.body;

 
      const user = await storage.getUserByEmail(userId)

      if(!user){
        return res.status(400).json({ message: 'User with this email dose not exist' });
      }


      const verificationCode = await storage.getVerificationCode(user.id, 'email_verification', code);
      if (!verificationCode) {
        return res.status(400).json({ message: 'Invalid or expired verification code' });
      }

      await storage.updateUser(user.id, { emailVerified: true });
      await storage.markVerificationCodeUsed(verificationCode.id);

      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({ message: 'Email verification failed' });
    }
  });

  app.post('/api/auth/verify-2fa', async (req, res) => {
    try {
      const { userId, code } = req.body;

      

      const verificationCode = await storage.getVerificationCode(userId, 'two_factor', code);
      if (!verificationCode) {
        return res.status(400).json({ message: 'Invalid or expired verification code' });
      }

      const user = await storage.getUser(userId);
      console.log(user?.email)
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      await storage.markVerificationCodeUsed(verificationCode.id);

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Update last active
      await storage.updateUser(user.id, { lastActive: new Date() });

      res.json({ 
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isLawyer: user.isLawyer,
          twoFactorEnabled: user.twoFactorEnabled,
        }
      });
    } catch (error) {
      console.error('2FA verification error:', error);
      res.status(500).json({ message: '2FA verification failed' });
    }
  });

  // 2FA Setup Routes
  app.post('/api/auth/2fa/setup/totp', authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const totpSetup = await twoFactorService.generateTOTPSecret(user.email);

      // Store the secret temporarily (user needs to verify before it's saved)
      await storage.updateUser(user.id, { 
        twoFactorSecret: totpSetup.secret,
        twoFactorMethod: 'totp'
      });

      res.json({
        secret: totpSetup.secret,
        qrCodeUrl: totpSetup.qrCodeUrl,
        backupCodes: totpSetup.backupCodes
      });
    } catch (error) {
      console.error('TOTP setup error:', error);
      res.status(500).json({ message: 'Failed to setup TOTP' });
    }
  });

  app.post('/api/auth/2fa/setup/email', authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Send test verification code
      const testCode = generateVerificationCode();
      await storage.createVerificationCode({
        userId: user.id,
        code: testCode,
        type: 'two_factor',
        used: false,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      });

      await sendVerificationCode(user.email, testCode, '2fa_email');

      res.json({ message: 'Test code sent to your email. Please verify to enable email 2FA.' });
    } catch (error) {
      console.error('Email 2FA setup error:', error);
      res.status(500).json({ message: 'Failed to setup email 2FA' });
    }
  });

  app.post('/api/auth/2fa/verify-setup', authenticateToken, async (req: any, res) => {
    try {
      const { code, method } = req.body;
      const user = await storage.getUser(req.user.userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      let isValid = false;

      if (method === 'totp') {
        if (!user.twoFactorSecret) {
          return res.status(400).json({ message: 'TOTP not set up' });
        }
        isValid = twoFactorService.verifyTOTP(code, user.twoFactorSecret);
      } else if (method === 'email') {
        const verificationCode = await storage.getVerificationCode(user.id, 'two_factor', code);
        isValid = !!verificationCode;
        if (isValid && verificationCode) {
          await storage.markVerificationCodeUsed(verificationCode.id);
        }
      }

      if (!isValid) {
        return res.status(400).json({ message: 'Invalid verification code' });
      }

      // Enable 2FA
      await storage.updateUser(user.id, { 
        twoFactorEnabled: true,
        twoFactorMethod: method
      });

      res.json({ message: '2FA enabled successfully' });
    } catch (error) {
      console.error('2FA verification setup error:', error);
      res.status(500).json({ message: 'Failed to verify 2FA setup' });
    }
  });

  app.post('/api/auth/2fa/disable', authenticateToken, async (req: any, res) => {
    try {
      const { password } = req.body;
      const user = await storage.getUser(req.user.userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Verify password before disabling 2FA
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid password' });
      }

      await storage.updateUser(user.id, { 
        twoFactorEnabled: false,
        twoFactorMethod: undefined,
        twoFactorSecret: undefined
      });

      res.json({ message: '2FA disabled successfully' });
    } catch (error) {
      console.error('2FA disable error:', error);
      res.status(500).json({ message: 'Failed to disable 2FA' });
    }
  });

  // Enhanced 2FA verification for login
  app.post('/api/auth/verify-2fa-enhanced', async (req, res) => {
    try {
      const { userId, code, method } = req.body;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      let isValid = false;

      if (method === 'totp' && user.twoFactorSecret) {
        isValid = twoFactorService.verifyTOTP(code, user.twoFactorSecret);
      } else if (method === 'email') {
        const verificationCode = await storage.getVerificationCode(user.id, 'two_factor', code);
        isValid = !!verificationCode;
        if (isValid && verificationCode) {
          await storage.markVerificationCodeUsed(verificationCode.id);
        }
      }

      if (!isValid) {
        return res.status(400).json({ message: 'Invalid verification code' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Update last active
      await storage.updateUser(user.id, { lastActive: new Date() });

      res.json({ 
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isLawyer: user.isLawyer,
          twoFactorEnabled: user.twoFactorEnabled,
          twoFactorMethod: user.twoFactorMethod,
        }
      });
    } catch (error) {
      console.error('Enhanced 2FA verification error:', error);
      res.status(500).json({ message: 'Enhanced 2FA verification failed' });
    }
  });

  // Protected routes
  app.get('/api/user/profile', authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        location: user.location,
        profileImageUrl: user.profileImageUrl,
        isLawyer: user.isLawyer,
        twoFactorEnabled: user.twoFactorEnabled,
        twoFactorMethod: user.twoFactorMethod,
        emailVerified: user.emailVerified,
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ message: 'Failed to get user profile' });
    }
  });

  // Chat routes
  app.post('/api/chat/sessions', authenticateToken, async (req: any, res) => {
    try {
      const sessionData = insertChatSessionSchema.parse({
        userId: req.user.userId,
        title: req.body.title || 'New Chat Session',
      });

      const session = await storage.createChatSession(sessionData);
      res.status(201).json(session);
    } catch (error) {
      console.error('Create chat session error:', error);
      res.status(500).json({ message: 'Failed to create chat session' });
    }
  });

  app.get('/api/chat/sessions', authenticateToken, async (req: any, res) => {
    try {
      const sessions = await storage.getChatSessions(req.user.userId);
      res.json(sessions);
    } catch (error) {
      console.error('Get chat sessions error:', error);
      res.status(500).json({ message: 'Failed to get chat sessions' });
    }
  });

  app.get('/api/chat/sessions/:id/messages', authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;

      // Verify session belongs to user
      const session = await storage.getChatSession(id);
      if (!session || session.userId !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const messages = await storage.getChatMessages(id);
      res.json(messages);
    } catch (error) {
      console.error('Get chat messages error:', error);
      res.status(500).json({ message: 'Failed to get chat messages' });
    }
  });

  // Lawyer routes
  app.get('/api/lawyers', async (req, res) => {
    try {
      const { specialization, location, language, minRating } = req.query;

      const lawyers = await storage.getLawyers({
        specialization: specialization as string,
        location: location as string,
        language: language as string,
        minRating: minRating ? parseInt(minRating as string) : undefined,
      });

      res.json(lawyers);
    } catch (error) {
      console.error('Get lawyers error:', error);
      res.status(500).json({ message: 'Failed to get lawyers' });
    }
  });

  app.get('/api/lawyers/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const lawyer = await storage.getLawyer(id);

      if (!lawyer) {
        return res.status(404).json({ message: 'Lawyer not found' });
      }

      res.json(lawyer);
    } catch (error) {
      console.error('Get lawyer error:', error);
      res.status(500).json({ message: 'Failed to get lawyer' });
    }
  });

  // Notifications routes
  app.get('/api/notifications', authenticateToken, async (req: any, res) => {
    try {
      const notifications = await storage.getUserNotifications(req.user.userId);
      res.json(notifications);
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({ message: 'Failed to get notifications' });
    }
  });

  app.patch('/api/notifications/:id/read', authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.markNotificationRead(id);
      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      console.error('Mark notification read error:', error);
      res.status(500).json({ message: 'Failed to mark notification as read' });
    }
  });

  return httpServer;
}