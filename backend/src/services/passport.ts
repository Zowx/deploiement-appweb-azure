import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import prisma from "./prisma.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // The auth router is mounted under `/api` so callback must include that prefix
      callbackURL: `${process.env.BASE_URL || "http://localhost:3001"}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Try to find existing user by Google profile id
        const existing = await prisma.user.findUnique({ where: { googleId: profile.id } });

        if (existing) {
          return done(null, existing);
        }

        // Create new user record
        const email = profile.emails?.[0]?.value ?? null;
        const photo = profile.photos?.[0]?.value ?? null;

        const created = await prisma.user.create({
          data: {
            googleId: profile.id,
            displayName: profile.displayName ?? null,
            email,
            photoUrl: photo,
          },
        });

        return done(null, created);
      } catch (err) {
        return done(err as any);
      }
    },
  ),
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user ?? null);
  } catch (err) {
    done(err as any);
  }
});

export default passport;
