import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Provider } from "next-auth/providers";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { writeAccessLog } from "@/lib/access-log";

const initialAdmins = (process.env.INITIAL_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const providers: Provider[] = [
  MicrosoftEntraID({
    clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
    clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
    // Tenant único da Proative: https://login.microsoftonline.com/<TENANT_ID>/v2.0
    issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    // Não busca foto no Graph (evita gravar imagem em base64 no banco)
    profile(profile) {
      return {
        id: profile.sub,
        name: profile.name,
        email: String(profile.email ?? profile.preferred_username ?? "").toLowerCase(),
        image: null,
      };
    },
  }),
];

// Login de desenvolvimento: só existe fora de produção e com DEV_LOGIN=1
const devLogin = process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN === "1";
if (devLogin) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Desenvolvimento",
      credentials: { email: { label: "E-mail" } },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase();
        const user = await db.user.findUnique({ where: { email } });
        return user?.active ? user : null;
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  // Credentials (dev) exige JWT; em produção a sessão é JWT curta, e o usuário é relido do banco a cada request
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  providers,
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // Só entra quem já é usuário ativo, foi convidado ou é admin inicial
    async signIn({ user, account }) {
      if (account?.provider === "dev") return true;
      const email = user.email?.toLowerCase();
      if (!email) return false;
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) return existing.active;
      if (initialAdmins.includes(email)) return true;
      const invite = await db.invite.findUnique({ where: { email } });
      return Boolean(invite);
    },
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      const u = user.email ? await db.user.findUnique({ where: { email: user.email.toLowerCase() }, select: { id: true } }) : null;
      writeAccessLog({ userId: u?.id ?? null, kind: "AUTH", path: "/login", name: `login:${account?.provider ?? "?"}` });
    },
    async signOut() {
      writeAccessLog({ kind: "AUTH", path: "/login", name: "logout" });
    },
    // Primeiro acesso: aplica perfil e diretorias do convite
    async createUser({ user }) {
      const email = user.email!.toLowerCase();
      if (initialAdmins.includes(email)) {
        await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
      }
      const invite = await db.invite.findUnique({ where: { email } });
      if (invite) {
        await db.user.update({
          where: { id: user.id },
          data: {
            role: initialAdmins.includes(email) ? "ADMIN" : invite.role,
            directorates: {
              create: invite.directorateIds.map((directorateId) => ({
                directorateId,
                access: invite.role === "LEITOR" ? "LEITURA" : "EDICAO",
              })),
            },
          },
        });
        await db.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      }
      await audit({
        actorId: user.id!,
        action: "user.firstLogin",
        entityType: "User",
        entityId: user.id!,
        summary: `${user.name ?? email} acessou o portal pela primeira vez`,
      });
    },
  },
});

export const devLoginEnabled = devLogin;
