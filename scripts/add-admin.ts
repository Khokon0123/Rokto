/**
 * Creates an admin login, or changes the password of one that exists.
 *
 * Usage (from the project folder):
 *   npm run admin:add -- you@example.com
 *
 * --conditions=react-server (in the npm script) is what lets this import the app's own code: the
 * `server-only` marker throws in plain Node, and that condition resolves it to its no-op build.
 *
 * The password is typed at the prompt and never echoed, never stored in a file, never passed as an
 * argument (shell history keeps those) and never sent anywhere but Firestore, hashed. Uses the same
 * FIREBASE_ADMIN_* variables as the app, so it writes to whichever project .env.local points at.
 * Against the emulator: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx tsx --conditions=react-server scripts/add-admin.ts you@example.com
 */
import { cert, initializeApp } from "firebase-admin/app";
import { ADMIN_MIN_PASSWORD_LENGTH } from "../src/config/app";

function app() {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || "demo-rokto" });
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("FIREBASE_ADMIN_* variables are missing (see .env.example).");
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

/**
 * Asks for the passwords without echoing them, so neither appears on screen or in scrollback.
 *
 * Written against stdin directly rather than readline: readline buffers the whole stream, so a
 * second prompt never sees its line, and the process then exits silently with nothing printed.
 * A terminal is read in raw mode a key at a time; piped input (tests) is read as plain lines.
 */
async function askPasswords(first: string, second: string): Promise<[string, string]> {
  if (process.stdin.isTTY !== true) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    const lines = Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
    return [lines[0] ?? "", lines[1] ?? ""];
  }

  const readOne = (prompt: string) =>
    new Promise<string>((resolve, reject) => {
      process.stdout.write(prompt);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      let value = "";
      const onData = (buf: Buffer) => {
        for (const byte of buf) {
          if (byte === 3) {
            // Ctrl-C: leave the terminal as we found it before giving up.
            done();
            reject(new Error("Cancelled. Nothing was changed."));
            return;
          }
          if (byte === 13 || byte === 10) {
            done();
            process.stdout.write("\n");
            resolve(value);
            return;
          }
          if (byte === 127 || byte === 8) value = value.slice(0, -1);
          else if (byte >= 32) value += String.fromCharCode(byte);
        }
      };
      const done = () => {
        process.stdin.off("data", onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
      };
      process.stdin.on("data", onData);
    });

  return [await readOne(first), await readOne(second)];
}

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Usage: npm run admin:add -- you@example.com");

  app();
  const { upsertAdminUser } = await import("../src/lib/server/adminUsers");

  const [password, again] = await askPasswords(
    `Password for ${email} (at least ${ADMIN_MIN_PASSWORD_LENGTH} characters): `,
    "Type it again: ",
  );
  if (password !== again) throw new Error("Those did not match. Nothing was changed.");

  const { created } = await upsertAdminUser(email, password);
  console.log(created ? `Created admin login for ${email}.` : `Password changed for ${email}.`);
  console.log("Sign in at /admin/login with that email and password.");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  // exitCode, not exit(): process.exit() drops whatever stdout has not flushed yet, which on a
  // pipe means the message above never arrives.
  process.exitCode = 1;
});
