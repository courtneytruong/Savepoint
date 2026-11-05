# Build stage: has the full SDK, and is thrown away after the build.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore before copying the code, so Docker reuses this step until the
# dependencies change.
COPY global.json ./
COPY Savepoint.Api/Savepoint.Api.csproj Savepoint.Api/
RUN dotnet restore Savepoint.Api/Savepoint.Api.csproj

COPY Savepoint.Api/ Savepoint.Api/
RUN dotnet publish Savepoint.Api/Savepoint.Api.csproj --configuration Release --no-restore --output /app/publish /p:UseAppHost=false

# Runtime stage: the final image, with only the runtime and the compiled app.
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# APP_UID is a non-root user provided by the .NET base image.
USER $APP_UID
ENTRYPOINT ["dotnet", "Savepoint.Api.dll"]
