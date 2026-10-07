# Natthaphong To-Do

A full-stack to-do assignment: register, log in, and add, complete or delete your own tasks. The responsive frontend uses HTML, CSS and JavaScript. Express supplies the API. SQLite stores users, hashed passwords, sessions and tasks.

## Run locally

Requires Node.js 24 or later.

```sh
npm ci
npm test
npm start
```

Open http://localhost:3000. Create an account with a 3–24 character username (letters, numbers and underscores) and a password of 10–128 characters. No seeded passwords or shared accounts are included. Local development automatically creates `data/tasks.db`, which is ignored by Git.

## Plan and files

1. Build the registration/login API and SQLite schema.
2. Make every task query depend on the current session's user ID.
3. Build the accessible task interface.
4. Test the real HTTP API with temporary SQLite databases and two users.
5. Publish the source and deploy on Vercel with hosted SQLite.

| File | Purpose |
| --- | --- |
| `app.js` | Express application and API routes |
| `server.mjs` | Local HTTP entry point |
| `lib/database.mjs` | Local SQLite / hosted Turso connection |
| `lib/schema.mjs` | SQLite tables and indexes |
| `lib/security.mjs` | Password hashing and session token helpers |
| `public/index.html` | Login and task views |
| `public/app.js` | Browser requests and safe DOM updates |
| `public/style.css` | Responsive design |
| `test/app.test.mjs` | Login, validation and isolation tests |
| `vercel.json` | Express deployment configuration |

## How the layers connect

The browser renders the interface and sends JSON to the API. Express checks input and the session cookie. SQLite reads or writes rows scoped to the authenticated user. The API returns JSON and the browser updates the list. The browser never connects directly to the database.

For example, Add task sends `POST /api/tasks` with a title. The API checks the session and validates a trimmed, nonempty title, inserts it with the session's user ID, and returns the new task. The browser displays that result.

## Routes

| Method and path | Behavior |
| --- | --- |
| `POST /api/register` | Create an account and session |
| `POST /api/login` | Verify password and create session |
| `POST /api/logout` | Revoke current session |
| `GET /api/me` | Current user |
| `GET /api/tasks` | Only the current user's tasks |
| `POST /api/tasks` | Add a task owned by current user |
| `PATCH /api/tasks/:id` | Complete or reopen own task |
| `DELETE /api/tasks/:id` | Delete own task |

## Database schema and security

- `users`: unique normalized username, salted scrypt password hash; no plaintext passwords.
- `sessions`: SHA-256 hash of random 256-bit token, user ID and expiry. Tokens are sent only in HttpOnly, SameSite=Lax cookies, Secure on Vercel; sessions expire after seven days.
- `tasks`: owner user ID, title, completed flag and creation time.
- `auth_attempts`: login/register throttling buckets; 20 attempts per 15 minutes per IP and username combination.

All SQL uses bound parameters. Task reads and writes include `user_id`; guessing another task's ID returns 404. Task text is rendered through `textContent`, not HTML. The API rejects cross-origin mutations, oversized JSON, blank/long titles and malformed completed values. `.env`, database files, tokens and installed dependencies are ignored by Git.

## Try to break it

Create users A and B in separate browser profiles. Add a task as A. B's list must be empty; attempting to update or delete A's ID as B must return 404. A must still see the task. Submit an empty or whitespace title: the API must return 400. Log out and request tasks: the API must return 401. The automated tests exercise these cases over actual HTTP with a real temporary SQLite file.

## Deployment

Vercel's local filesystem is ephemeral. A local SQLite file is suitable for the local demo, but production needs a hosted database. This project supports **Turso hosted SQLite** using `@libsql/client`, preserving the assignment's SQLite requirement. Connect the Turso integration to the Vercel project, or set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` privately through Vercel. Never put actual credentials into this repository. Tables initialize on the first API request. Production deliberately reports an unavailable database rather than falling back to a temporary file.

Import this public repository into Vercel. The Express framework preset needs no build command or output directory. Run the tests before publishing. No payment, email, AI or other paid integration is required by the application.

## Submission and verified checks

Public repository: https://github.com/treetest94-svg/Natthaphong-To-Do

Local validation: **14 tests passed, 0 failed** on Node.js 24.19.0. Tests used real HTTP and a real SQLite file. Cross-user update/delete attempts returned 404, blank tasks returned 400, and revoked/expired sessions returned 401. No failing behavior was observed in this run; the input validation and owner restrictions are implemented in the first version.

Live deployment is pending hosted SQLite provisioning. Do not treat the local test result as verification of the public deployment.
