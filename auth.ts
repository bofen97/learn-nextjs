import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import type { User } from "@/app/lib/definitions";
import bcrypt from "bcrypt";

async function getUser(email: string): Promise<User | undefined> {
  try {
    const user = await sql<User>`SELECT * FROM users WHERE email=${email}`;
    return user.rows[0];
  } catch (error) {
    console.error("Failed to fetch user:", error);
    throw new Error("Failed to fetch user.");
  }
}

export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);
        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          const user = await getUser(email);
          if (!user) return null;
          const passwordsMatch = await bcrypt.compare(password, user.password);
          if (passwordsMatch) return user;
        }
        console.log("Invalid credentials");

        return null;
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      try {
        if (user) {
          // 可以在这里添加额外的登录验证逻辑
          // 例如检查用户状态、验证邮箱等
          return true;
        }
        return false;
      } catch (error) {
        console.error("SignIn callback error:", error);
        return false;
      }
    },
    // 处理 JWT Token
    async jwt({ token, user, account, profile, trigger }) {
      try {
        if (user) {
          // 首次登录，将用户信息添加到 token
          token.id = user.id;
          token.role = user.role;
          token.name = user.name;
        }

        // 处理会话更新
        if (trigger === "update") {
          const updatedUser = await getUser(token.email as string);
          if (updatedUser) {
            token.role = updatedUser.role;
            token.name = updatedUser.name;
          }
        }

        return token;
      } catch (error) {
        console.error("JWT callback error:", error);
        return token;
      }
    },
    // 处理会话
    async session({ session, token, user }) {
      try {
        return {
          ...session,
          user: {
            ...session.user,
            id: token.id,
            role: token.role,
            email: token.email,
            name: token.name,
          },
        };
      } catch (error) {
        console.error("Session callback error:", error);
        return session;
      }
    },
    async authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      const isOnLogin = nextUrl.pathname.startsWith("/login");

      if (isOnLogin) {
        if (isLoggedIn) {
          // 如果已登录且试图访问登录页，重定向到仪表板
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      } else if (isOnDashboard) {
        if (isLoggedIn) return true;
        // 如果未登录且试图访问仪表板，重定向到登录页
        return Response.redirect(new URL("/login", nextUrl));
      }

      return true; // 默认允许访问
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 天
    updateAge: 24 * 60 * 60, // 24 小时更新一次
  },

  // 页面配置
  pages: {
    signIn: "/login",
    error: "/error",
  },
  // 事件处理
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      // 登录成功事件处理
      console.log(`User ${user.email} signed in`);
    },
    async signOut({ session, token }) {
      // 登出事件处理
      console.log(`User signed out`);
    },
    async error(error) {
      // 错误事件处理
      console.error("Auth error:", error);
    },
  },
});
