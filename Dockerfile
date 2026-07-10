# --- Build stage ---
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy csproj files first (better Docker layer caching)
COPY src/SathiSOS.API/*.csproj src/SathiSOS.API/
COPY src/SathiSOS.Application/*.csproj src/SathiSOS.Application/
COPY src/SathiSOS.Domain/*.csproj src/SathiSOS.Domain/
COPY src/SathiSOS.Infrastructure/*.csproj src/SathiSOS.Infrastructure/

RUN dotnet restore src/SathiSOS.API/SathiSOS.API.csproj

# Copy the rest of the source and publish
COPY src/ src/
RUN dotnet publish src/SathiSOS.API/SathiSOS.API.csproj -c Release -o /app/publish

# --- Runtime stage ---
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# Render provides the PORT env var — ASP.NET must bind to it
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "SathiSOS.API.dll"]