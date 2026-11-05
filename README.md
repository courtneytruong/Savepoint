# Savepoint

A personal journal for the books you read and the games you play.

## Run the API locally

You need Docker Desktop and the .NET 10 SDK.

1. Create your settings file, then open `.env` and set your own password. Use only letters and numbers, so it needs no escaping in connection strings.

   ```powershell
   Copy-Item .env.example .env
   ```

2. Start the database.

   ```powershell
   docker compose up -d --wait
   ```

3. Give the API its connection string, using the same password as `.env`. User Secrets stores it outside the repo, so it can't be committed.

   ```powershell
   dotnet user-secrets set "ConnectionStrings:Savepoint" "Host=127.0.0.1;Port=5432;Database=savepoint;Username=savepoint;Password=YOUR_PASSWORD" --project api/Savepoint.Api
   ```

4. Run the API.

   ```powershell
   dotnet run --project api/Savepoint.Api
   ```

5. Open <http://localhost:8080/health>. You should see `Healthy`, or `Unhealthy` with a 503 status if the API can't reach the database.

If you change the password in `.env` after the database has been created, the database keeps the old one. Update it inside the database as well, then update the user secret.
