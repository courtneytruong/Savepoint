# Savepoint

A personal journal for the books you read and the games you play.

## Run the app

You need Docker Desktop.

1. Create your settings file, then open `.env` and set your own password. Use only letters and numbers, so it needs no escaping in connection strings.

   ```powershell
   Copy-Item .env.example .env
   ```

2. Build and start the database and API.

   ```powershell
   docker compose up -d --build --wait
   ```

3. Open <http://localhost:8080/health>. You should see `Healthy`, or `Unhealthy` with a 503 status if the API can't reach the database.

The image holds a copy of the compiled code, so run the command in step 2 again to pick up code changes.

To stop everything, run `docker compose down`. Your data stays in a Docker volume. Adding `-v` to that command **deletes the volume and all your data**.

If you change the password in `.env` after the database has been created, the database keeps the old one. Update it inside the database as well.

## Run the frontend

The frontend doesn't run in Docker yet. It needs Node.js 22.12 or newer, and the database and API running.

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. You should see one of these:

| Message | Meaning |
|---|---|
| All systems connected | The frontend, API and database are all working |
| The API is up, but it can't reach the database | Check the database with `docker compose ps` |
| Can't reach the API | Check the backend with `docker compose ps` and `docker compose logs backend` |

The page checks once when it loads, so reload it to check again.

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
