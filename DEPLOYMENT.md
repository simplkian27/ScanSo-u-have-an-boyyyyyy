# ContainerFlow Deployment Guide for Render.com

This guide walks you through deploying ContainerFlow to Render.com.

## Prerequisites

1. A Render.com account (free tier available)
2. A PostgreSQL database (Supabase, Neon, or Render PostgreSQL)
3. Your code pushed to a GitHub repository

## Step 1: Download Your Code from Replit

1. In Replit, click the three-dot menu (⋮) in the file panel
2. Select "Download as ZIP"
3. Extract the ZIP file on your computer

## Step 2: Push to GitHub

1. Create a new repository on GitHub
2. Push your code:
   ```bash
   cd containerflow
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/containerflow.git
   git push -u origin main
   ```

## Step 3: Set Up Your Database

### Option A: Use Supabase (Recommended)
1. Go to [supabase.com](https://supabase.com) and create a project
2. Go to Settings → Database → Connection String
3. Copy the "URI" connection string
4. Run the database setup:
   ```bash
   DATABASE_URL="your-connection-string" npm run db:push
   ```

### Option B: Use Render PostgreSQL
1. In Render dashboard, click "New" → "PostgreSQL"
2. Choose the free tier
3. Copy the "External Database URL" after creation

## Step 4: Deploy to Render

### Automatic Deployment (Recommended)

1. Go to [render.com](https://render.com) and sign in
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Render will detect the `render.yaml` file automatically
5. You'll be prompted to set environment variables:

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | Your PostgreSQL connection string |
   | `ALLOWED_ORIGINS` | `https://your-frontend-domain.com` (or `*` for testing) |

6. Click "Apply" to deploy

### Manual Deployment

1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `containerflow-api`
   - **Region**: Frankfurt (or closest to you)
   - **Branch**: `main`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run server:build`
   - **Start Command**: `npm run server:start`
4. Add environment variables:
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = your PostgreSQL connection string
   - `ALLOWED_ORIGINS` = your frontend domain(s)
5. Click "Create Web Service"

## Step 5: Initialize the Database

After deployment, you need to create the database tables:

1. On your local machine, run:
   ```bash
   DATABASE_URL="your-production-database-url" npm run db:push
   ```

2. Or use Render's Shell feature to run the migration

## Step 6: Verify Deployment

1. Your API will be available at: `https://containerflow-api.onrender.com`
2. Test the health endpoint: `https://containerflow-api.onrender.com/api/health`
3. You should see: `{"status":"ok","database":"connected"}`

## Step 7: Build the Mobile App

The app is pre-configured to use `https://containerflow-api.onrender.com` as the production API.

**Build static bundles:**
```bash
npm run expo:static:build
```

**Or for native builds with EAS:**
```bash
eas build --platform all
```

To use a different API URL, set `EXPO_PUBLIC_API_URL`:
```bash
EXPO_PUBLIC_API_URL=https://your-custom-api.com npm run expo:static:build
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ALLOWED_ORIGINS` | Yes | Comma-separated list of allowed CORS origins |
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | No | Server port (default: 5000, Render sets this automatically) |

## Test Credentials

After deployment, you can log in with:
- **Admin**: `admin@containerflow.com` / `admin`
- **Driver**: `fahrer@containerflow.com` / `123`

## Troubleshooting

### "Database connection failed"
- Verify your `DATABASE_URL` is correct
- Ensure your database allows external connections
- Check if SSL is required (add `?sslmode=require` to the URL if needed)

### "CORS error"
- Make sure `ALLOWED_ORIGINS` includes your frontend domain
- For testing, you can set it to `*` (not recommended for production)

### Build fails
- Check that all dependencies are in `package.json`
- Verify Node.js version compatibility (Node 18+)

## Support

For issues specific to Render.com, visit their [documentation](https://render.com/docs).
