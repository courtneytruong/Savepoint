# Savepoint

A personal journal for the books you read and the games you play.

## Run the app

You need Docker Desktop.

1. Create your settings file, then open `.env` and set your own password. Use only letters and numbers, so it needs no escaping in connection strings.

   ```powershell
   Copy-Item .env.example .env
   ```

2. Build and start the database, API and frontend.

   ```powershell
   docker compose up -d --build --wait
   ```

3. Open <http://localhost:3000>. You should see one of these:

   | Message | Meaning |
   |---|---|
   | All systems connected | The frontend, API and database are all working |
   | The API is up, but it can't reach the database | Check the database with `docker compose ps` |
   | Can't reach the API | Check the backend with `docker compose ps` and `docker compose logs backend` |

   The page checks once when it loads, so reload it to check again.

The images hold a copy of the built code, so run the command in step 2 again to pick up code changes.

To stop everything, run `docker compose down`. Your data stays in a Docker volume. Adding `-v` to that command **deletes the volume and all your data**.

If you change the password in `.env` after the database has been created, the database keeps the old one. Update it inside the database as well.

## Run the frontend outside Docker (optional)

This gives you instant reloading while you work on the frontend. It needs Node.js 22.12 or newer, and the API running. It can run at the same time as the frontend container.

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

## Run the API outside Docker (optional)

This needs the .NET 10 SDK, and the database still runs in Docker.

1. Free up port 8080 by stopping the backend container.

   ```powershell
   docker compose stop backend
   ```

2. Give the API its connection string, using the same password as `.env`. User Secrets stores it outside the repo, so it can't be committed. You only need to do this once, or again if the password changes.

   ```powershell
   dotnet user-secrets set "ConnectionStrings:Savepoint" "Host=127.0.0.1;Port=5432;Database=savepoint;Username=savepoint;Password=YOUR_PASSWORD" --project backend/Savepoint.Api
   ```

3. Run the API.

   ```powershell
   dotnet run --project backend/Savepoint.Api
   ```

## Run the backend tests

This needs the .NET 10 SDK. The tests don't need Docker or a running database. Run them from the `backend` folder, because the test runner setting is in `backend/global.json`.

```powershell
cd backend
dotnet test --solution Savepoint.slnx
```

## Run the frontend tests

This needs Node.js 22.12 or newer. The tests don't need Docker or the API, because they replace the API's responses with their own.

```powershell
cd frontend
npm install
npm test
```
