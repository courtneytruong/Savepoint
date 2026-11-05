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

## Run the API outside Docker (optional)

This needs the .NET 10 SDK, and the database still runs in Docker.

1. Free up port 8080 by stopping the API container.

   ```powershell
   docker compose stop api
   ```

2. Give the API its connection string, using the same password as `.env`. User Secrets stores it outside the repo, so it can't be committed. You only need to do this once, or again if the password changes.

   ```powershell
   dotnet user-secrets set "ConnectionStrings:Savepoint" "Host=127.0.0.1;Port=5432;Database=savepoint;Username=savepoint;Password=YOUR_PASSWORD" --project api/Savepoint.Api
   ```

3. Run the API.

   ```powershell
   dotnet run --project api/Savepoint.Api
   ```
